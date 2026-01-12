import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { buildPlanRequest, generatePlan } from '../lib/calculatorApi.js'
import CalculatorApp from '../App.jsx'
import FullPageLoader from '../components/FullPageLoader.jsx'
import { useCalculatorSnapshot } from '../lib/useCalculatorSnapshot.js'

export default function CreateDeal() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // OCR moved into Client Information section (ClientIdScanner component)

  // Server-calculation integration
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [standardPlan, setStandardPlan] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [calcResult, setCalcResult] = useState(null)

  // Visibility helper: other deals for the same unit (to show a warning banner)
  const [unitDeals, setUnitDeals] = useState([])

  const navigate = useNavigate()
  const { ready, getSnap, applyClient, apply, applyPrefill } = useCalculatorSnapshot()

  // Fetch global standard plan on mount
  useEffect(() => {
    ;(async () => {
      try {
        const resp = await fetchWithAuth(`${API_URL}/api/standard-plan/latest`)
        const data = await resp.json()
        if (resp.ok) {
          setStandardPlan(data.standardPlan || null)
        }
      } catch {}
    })()
  }, [])

  // On mount: ensure unit_id provided; if not, redirect to Inventory.
  // If unit_id is present, fetch unit and prefill calculator. If plan_id is present, hydrate from that plan snapshot.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const unitId = Number(params.get('unit_id'))
    const planId = Number(params.get('plan_id'))
    if (!Number.isFinite(unitId) || unitId <= 0) {
      // No unit selected -> go to Inventory to pick one
      navigate('/deals/inventory', { replace: true })
      return
    }
    ;(async () => {
      try {
        setLoading(true)
        // 1) Load selected unit
        const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/${unitId}`)
        const data = await resp.json()
        if (!resp.ok) {
          setError(data?.error?.message || 'Failed to load unit')
          return
        }
        const u = data.unit || {}
        setSelectedUnit(u)

        // 1b) Load any existing deals for this unit to surface potential conflicts.
        try {
          const dealsResp = await fetchWithAuth(`${API_URL}/api/deals/by-unit/${unitId}`)
          const dealsData = await dealsResp.json()
          if (dealsResp.ok && Array.isArray(dealsData.deals)) {
            setUnitDeals(dealsData.deals)
          } else {
            setUnitDeals([])
          }
        } catch (e) {
          // Non-fatal: conflict visibility is a UX aid only
          console.warn('Failed to load existing deals for unit', e?.message || e)
          setUnitDeals([])
        }

        // 2) Prefill with unit and standard plan baseline
        const base = Number(u.base_price || 0)
        const garden = Number(u.garden_price || 0)
        const roof = Number(u.roof_price || 0)
        const storage = Number(u.storage_price || 0)
        const garage = Number(u.garage_price || 0)
        const maintenance = Number(u.maintenance_price || 0)

        const sp = u.approved_standard_pricing || {}
        const stdBase = Number(sp.price || base)
        const stdGarden = Number(sp.garden_price || garden)
        const stdRoof = Number(sp.roof_price || roof)
        const stdStorage = Number(sp.storage_price || storage)
        const stdGarage = Number(sp.garage_price || garage)
        const stdMaintenance = Number(sp.maintenance_price || maintenance)
        const stdTotal = stdBase + stdGarden + stdRoof + stdStorage + stdGarage

        const approvedStd = u.standardPlan || {
          totalPrice: stdTotal,
          financialDiscountRate: Number(standardPlan?.std_financial_rate_percent) || 0,
          calculatedPV: stdTotal
        }

        try {
          applyPrefill({
            unitInfo: {
              unit_type: (u.model_code ? `${u.model_code} — ` : '') + (u.model_name || u.unit_type || u.unit_type_name || ''),
              unit_code: u.code || '',
              unit_number: u.unit_number || '',
              floor: u.floor || '',
              building_number: u.building_number || '',
              block_sector: u.block_sector || '',
              zone: u.zone || '',
              garden_details: u.garden_details || '',
              area: u.area || '',
              orientation: u.orientation || '',
              has_garden: u.has_garden || false,
              garden_area: u.garden_area || '',
              has_roof: u.has_roof || false,
              roof_area: u.roof_area || '',
              garage_area: u.garage_area || '',
              unit_id: u.id,
              available: u.available,
              blocked_until: u.blocked_until || null
            },
            stdPlan: {
              totalPrice: Number(approvedStd.totalPrice) || stdTotal,
              base_price: stdBase,
              maintenance_price: stdMaintenance,
              financialDiscountRate: Number(approvedStd.financialDiscountRate) || 0,
              calculatedPV: Number(approvedStd.calculatedPV) || stdTotal
            },
            unitPricingBreakdown: {
              base: stdBase,
              garden: stdGarden,
              roof: stdRoof,
              storage: stdStorage,
              garage: stdGarage,
              maintenance: stdMaintenance,
              totalExclMaintenance: stdTotal
            },
            currency: u.currency || 'EGP'
          })
        } catch (err) {
          console.error('Error applying unit prefill:', err)
        }

        // 3) If planId present, hydrate from that plan snapshot (consultant edits)
        if (Number.isFinite(planId) && planId > 0) {
          try {
            const pResp = await fetchWithAuth(`${API_URL}/api/workflow/payment-plans/${planId}`)
            const pData = await pResp.json()
            if (pResp.ok && pData.payment_plan) {
              const snap = pData.payment_plan?.details?.calculator
              if (snap && typeof apply === 'function') {
                // Ensure unit id matches; if not, we still apply but keep selected unit baseline
                try { apply(snap) } catch (e) { console.warn('apply snapshot failed', e) }
              }
            }
          } catch (e) {
            console.warn('Failed to hydrate from plan_id:', e?.message || e)
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to load unit')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  

  

  

  async function buildPayloadFromSnapshot() {
    const snap = getSnap()
    if (!snap) {
      throw new Error('Calculator not ready yet. Please try again in a moment.')
    }
    // Build title, amount, unit type from snapshot
    const titleParts = []
    if (snap?.clientInfo?.buyer_name) titleParts.push(snap.clientInfo.buyer_name)
    if (snap?.unitInfo?.unit_code || snap?.unitInfo?.unit_number) {
      titleParts.push(snap.unitInfo.unit_code || snap.unitInfo.unit_number)
    }
    const title = titleParts.join(' - ') || 'New Deal'
    const amount = Number(snap?.generatedPlan?.totals?.totalNominal ?? snap?.stdPlan?.totalPrice ?? 0)
    const unitType = snap?.unitInfo?.unit_type || null
    const details = { calculator: { ...snap } }
    return { title, amount, unitType, details }
  }

  // Minimal required fields for creating an offer:
  // - Client name and primary phone
  // - Unit data: at least unit_type and either unit_code or unit_number
  function validateOfferSnapshot(snap) {
    const client = snap?.clientInfo || {}
    const unit = snap?.unitInfo || {}
    const missing = []
    if (!client.buyer_name || !String(client.buyer_name).trim()) missing.push('Client Name')
    if (!client.phone_primary || !String(client.phone_primary).trim()) missing.push('Client Primary Phone')
    if (!unit.unit_type || !String(unit.unit_type).trim()) missing.push('Unit Model')
    if (!(unit.unit_code || unit.unit_number)) missing.push('Unit Code or Unit Number')
    return { ok: missing.length === 0, missing }
  }

  async function saveAsDraft() {
    try {
      setError('')
      setLoading(true)
      const payload = await buildPayloadFromSnapshot()
      // Validate minimal offer info
      const snap = payload.details?.calculator
      const v = validateOfferSnapshot(snap)
      if (!v.ok) {
        throw new Error(`Missing required fields: ${v.missing.join(', ')}`)
      }
      const resp = await fetchWithAuth(`${API_URL}/api/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to create deal')
      // Clear local drafts on successful creation
      try {
        localStorage.removeItem(DRAFT_OCR_KEY)
      } catch {}
      navigate(`/deals/${data.deal.id}`)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  // Request a block on the selected unit (goes to approval chain)
  async function requestUnitBlock() {
    try {
      if (!selectedUnit?.id) {
        setError('Select a unit from Inventory first.')
        return
      }
      
      // Auto-save as draft first if not already saved (we don't have a deal ID yet)
      // But wait, CreateDeal doesn't have a deal ID in state until saved.
      // We need to save it first.
      
      const durationStr = window.prompt('Block duration in days (default 7):', '7')
      if (durationStr === null) return
      const durationDays = Number(durationStr) || 7
      const reason = window.prompt('Reason for block (optional):', '') || ''
      
      // Derive decision from embedded calculator snapshot if available
      let decision = null
      try {
        const snapFn = window.__uptown_calc_getSnapshot
        if (typeof snapFn === 'function') {
          const snap = snapFn()
          decision = snap?.generatedPlan?.evaluation?.decision || snap?.evaluation?.decision || null
        }
      } catch {}

      setLoading(true)
      // 1. Save as Draft
      const payload = await buildPayloadFromSnapshot()
      // Validate minimal offer info
      const snap = payload.details?.calculator
      const v = validateOfferSnapshot(snap)
      if (!v.ok) {
        throw new Error(`Missing required fields: ${v.missing.join(', ')}`)
      }
      const saveResp = await fetchWithAuth(`${API_URL}/api/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const saveData = await saveResp.json()
      if (!saveResp.ok) throw new Error(saveData?.error?.message || 'Failed to auto-save deal before blocking')
      
      // 2. Request Block using the new Deal ID (implicitly linked via user/unit, but we should probably pass deal_id if the API supported it, 
      // but the API currently looks up by unit_id and user. 
      // However, the FIX we implemented in blockManagement.js looks for a DEAL created by the user for this unit.
      // So simply having the deal saved in the DB is enough for the check to pass.)
      
      const resp = await fetchWithAuth(`${API_URL}/api/blocks/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: Number(selectedUnit.id), durationDays, reason, decision })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to request unit block')
      
      alert('Block request submitted for approval.')
      // Navigate to the new deal
      navigate(`/deals/${saveData.deal.id}`)
      
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function saveAndSubmit() {
    try {
      setError('')
      setSubmitting(true)
      const payload = await buildPayloadFromSnapshot()
      // Validate minimal offer info
      const snap = payload.details?.calculator
      const v = validateOfferSnapshot(snap)
      if (!v.ok) {
        throw new Error(`Missing required fields: ${v.missing.join(', ')}`)
      }
      // Validation: ensure generated plan exists
      const plan = payload.details?.calculator?.generatedPlan
      if (!plan || !Array.isArray(plan.schedule) || plan.schedule.length === 0) {
        throw new Error('Please generate a payment plan before submitting.')
      }
      const resp = await fetchWithAuth(`${API_URL}/api/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to create deal')
      // Clear local drafts after creation
      try {
        localStorage.removeItem(DRAFT_OCR_KEY)
      } catch {}
      // Submit
      const submitResp = await fetchWithAuth(`${API_URL}/api/deals/${data.deal.id}/submit`, { method: 'POST' })
      const submitData = await submitResp.json()
      if (!submitResp.ok) throw new Error(submitData?.error?.message || 'Failed to submit deal')
      navigate(`/deals/${data.deal.id}`)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function runOCR() {
    try {
      setOcrError('')
      setOcrResult(null)
      if (!ocrFile) {
        setOcrError('Please select an ID image first.')
        return
      }
      setOcrLoading(true)
      const form = new FormData()
      form.append('image', ocrFile)
      const resp = await fetchWithAuth(`${API_URL}/api/ocr/egypt-id`, {
        method: 'POST',
        body: form
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'OCR failed')
      setOcrResult(data)
      const fields = data?.fields || {}
      setReviewFields({
        name: String(fields.name || ''),
        nationalId: String(fields.nationalId || ''),
        address: String(fields.address || '')
      })
    } catch (e) {
      setOcrError(e.message || String(e))
    } finally {
      setOcrLoading(false)
    }
  }

  function applyToForm() {
    if (!ready) {
      setOcrError('Form not ready to accept data. Please try again.')
      return
    }
    const updates = {}
    if (reviewFields.name) updates.buyer_name = reviewFields.name
    if (reviewFields.nationalId) updates.id_or_passport = reviewFields.nationalId
    if (reviewFields.address) updates.address = reviewFields.address
    // If national ID present, assume Egyptian nationality
    if (reviewFields.nationalId && !/\D/.test(reviewFields.nationalId)) {
      updates.nationality = 'Egyptian'
    }
    applyClient(updates)
  }

  // Trigger server calculation using new backend engine
  async function calculateViaServer() {
    try {
      setCalcError('')
      setCalcResult(null)
      setCalcLoading(true)
      if (!selectedUnit) {
        throw new Error('Please select a unit from the inventory first.')
      }
      const snapFn = window.__uptown_calc_getSnapshot
      if (typeof snapFn !== 'function') {
        throw new Error('Calculator snapshot not ready. Please try again.')
      }
      const snap = snapFn()
      const genBody = buildPlanRequest(snap, Number(selectedUnit.id))
      const data = await generatePlan(genBody)
      setCalcResult({
        schedule: data.schedule || [],
        totals: data.totals || {},
        offerPV: Number(data?.meta?.calculatedPV || 0),
        meta: data.meta || {}
      })
    } catch (e) {
      setCalcError(e.message || String(e))
    } finally {
      setCalcLoading(false)
    }
  }

  return (
    <div>
      {calcLoading && <FullPageLoader text="Calculating…" />}
      <div className="flex justify-between items-baseline mb-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 m-0">Create Deal</h2>
        {/* Buttons moved to bottom */}
      </div>
      {error && <p className="text-red-600 mb-4 font-medium">{error}</p>}
      
      {loading && !error && <p className="text-gray-500 text-sm mb-4">Loading unit data...</p>}

      {/* Selected Unit Summary */}
      {selectedUnit && (
        <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-white shadow-sm">
          {/* Conflict banner: other deals on this unit */}
          {Array.isArray(unitDeals) && unitDeals.length > 0 && (
            <div className="mb-3 p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-sm">
              <div className="font-semibold mb-1">
                There are {unitDeals.length} existing deal(s) for this unit.
              </div>
              <div className="flex flex-wrap gap-2">
                {unitDeals.slice(0, 3).map(d => (
                  <span key={d.id} className="bg-white px-1.5 py-0.5 rounded border border-orange-100">
                    #{d.id} ({d.status || 'unknown'})
                  </span>
                ))}
                {unitDeals.length > 3 && <span>…</span>}
              </div>
              <div className="mt-1 text-xs opacity-75">
                This does not block creating a new offer, but consult your Sales Manager if there are conflicting offers.
              </div>
            </div>
          )}
          <div className="flex justify-between items-baseline mb-4">
            <h3 className="text-lg font-bold text-gray-800 m-0">Selected Unit</h3>
            <div className="flex gap-2">
              <button onClick={() => navigate('/deals/inventory')} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">Change Unit</button>
              {selectedUnit?.id && (
                <button
                  onClick={() => navigate(`/deals?unitId=${Number(selectedUnit.id)}`)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                  title="View all deals created for this unit"
                >
                  View Deals for This Unit
                </button>
              )}
              {/* Block button removed as per request (flow requires saving deal first) */}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-y-2 gap-x-4 text-sm text-gray-700">
            <div><strong className="font-semibold text-gray-900">Code:</strong> {selectedUnit.code || '-'}</div>
            <div><strong className="font-semibold text-gray-900">Model:</strong> {selectedUnit.model_code ? `${selectedUnit.model_code} — ${selectedUnit.model_name || ''}`.trim() : (selectedUnit.model_name || selectedUnit.unit_type || selectedUnit.unit_type_name || '-')}</div>
            <div><strong className="font-semibold text-gray-900">Number:</strong> {selectedUnit.unit_number || '-'}</div>
            <div><strong className="font-semibold text-gray-900">Floor:</strong> {selectedUnit.floor || '-'}</div>
            <div><strong className="font-semibold text-gray-900">Building:</strong> {selectedUnit.building_number || '-'}</div>
            <div><strong className="font-semibold text-gray-900">Block / Sector:</strong> {selectedUnit.block_sector || '-'}</div>
            <div><strong className="font-semibold text-gray-900">Zone:</strong> {selectedUnit.zone || '-'}</div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Price Breakdown (excl. maintenance)</h4>
            {(() => {
              const u = selectedUnit || {}
              const sp = u.approved_standard_pricing || {}
              const num = v => Number(v || 0)
              const base = num(sp.price || u.base_price)
              const garden = num(sp.garden_price || u.garden_price)
              const roof = num(sp.roof_price || u.roof_price)
              const storage = num(sp.storage_price || u.storage_price)
              const garage = num(sp.garage_price || u.garage_price)
              const maintenance = num(sp.maintenance_price || u.maintenance_price)
              const total = base + garden + roof + storage + garage
              const curr = u.currency || 'EGP'
              const fmt = (x) => Number(x || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
              return (
                <div className="grid grid-cols-6 gap-2 text-xs">
                  <div><span className="text-gray-500 block">Base</span><div className="font-medium text-gray-900">{fmt(base)} {curr}</div></div>
                  <div><span className="text-gray-500 block">Garden</span><div className="font-medium text-gray-900">{fmt(garden)} {curr}</div></div>
                  <div><span className="text-gray-500 block">Roof</span><div className="font-medium text-gray-900">{fmt(roof)} {curr}</div></div>
                  <div><span className="text-gray-500 block">Storage</span><div className="font-medium text-gray-900">{fmt(storage)} {curr}</div></div>
                  <div><span className="text-gray-500 block">Garage</span><div className="font-medium text-gray-900">{fmt(garage)} {curr}</div></div>
                  <div><span className="text-gray-500 block">Maintenance</span><div className="font-medium text-gray-900">{fmt(maintenance)} {curr}</div></div>
                  <div className="col-span-6 mt-2 p-2 border border-dashed border-gray-300 rounded bg-gray-50 flex justify-between items-center text-sm">
                    <strong className="text-gray-900">Total excl. maintenance:</strong> 
                    <span className="font-bold text-primary-dark">{fmt(total)} {curr}</span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      

      

      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <CalculatorApp embedded hideBlockButton />
      </div>

      <div className="mt-6 flex justify-end gap-3 pb-12">
        <button onClick={saveAsDraft} disabled={loading || submitting} className="px-6 py-3 rounded-xl border border-primary bg-primary text-white font-bold text-lg shadow-sm hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]">
          {loading ? 'Saving…' : 'Save as Draft'}
        </button>
        <button onClick={saveAndSubmit} disabled={loading || submitting} className="px-6 py-3 rounded-xl border border-primary-dark bg-primary-dark text-white font-bold text-lg shadow-sm hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]">
          {submitting ? 'Submitting…' : 'Save and Submit'}
        </button>
      </div>
    </div>
  )
}

