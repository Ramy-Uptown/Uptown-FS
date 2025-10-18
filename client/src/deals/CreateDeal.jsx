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
  // If unit_id is present, fetch unit and prefill calculator.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const unitId = Number(params.get('unit_id'))
    if (!Number.isFinite(unitId) || unitId <= 0) {
      // No unit selected -> go to Inventory to pick one
      navigate('/deals/inventory', { replace: true })
      return
    }
    ;(async () => {
      try {
        setLoading(true)
        const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/${unitId}`)
        const data = await resp.json()
        if (!resp.ok) {
          setError(data?.error?.message || 'Failed to load unit')
          return
        }
        const u = data.unit || {}
        setSelectedUnit(u)

        // Compute breakdown with all pricing components (current unit pricing)
        const base = Number(u.base_price || 0)
        const garden = Number(u.garden_price || 0)
        const roof = Number(u.roof_price || 0)
        const storage = Number(u.storage_price || 0)
        const garage = Number(u.garage_price || 0)
        const maintenance = Number(u.maintenance_price || 0)

        // Approved standard pricing from model (authoritative nominal components)
        const sp = u.approved_standard_pricing || {}
        const stdBase = Number(sp.price || base)
        const stdGarden = Number(sp.garden_price || garden)
        const stdRoof = Number(sp.roof_price || roof)
        const stdStorage = Number(sp.storage_price || storage)
        const stdGarage = Number(sp.garage_price || garage)
        const stdMaintenance = Number(sp.maintenance_price || maintenance)
        const stdTotal = stdBase + stdGarden + stdRoof + stdStorage + stdGarage

        // Approved Standard (Benchmark) attached by API (includes rate and standard PV when computable)
        const approvedStd = u.standardPlan || {
          totalPrice: stdTotal,
          financialDiscountRate: Number(standardPlan?.std_financial_rate_percent) || 0,
          calculatedPV: stdTotal
        }

        // Prefill embedded calculator via exposed bridge and sync local UI
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
              unit_id: u.id
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
      const durationStr = window.prompt('Block duration in days (default 7):', '7')
      if (durationStr === null) return
      const durationDays = Number(durationStr) || 7
      const reason = window.prompt('Reason for block (optional):', '') || ''
      const resp = await fetchWithAuth(`${API_URL}/api/blocks/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: Number(selectedUnit.id), durationDays, reason })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to request unit block')
      alert('Block request submitted for approval.')
    } catch (e) {
      setError(e.message || String(e))
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h2 style={{ marginTop: 0 }}>Create Deal</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={saveAsDraft} disabled={loading || submitting} style={btnPrimary}>{loading ? 'Saving…' : 'Save as Draft'}</button>
          <button onClick={saveAndSubmit} disabled={loading || submitting} style={btnPrimaryAlt}>{submitting ? 'Submitting…' : 'Save and Submit'}</button>
        </div>
      </div>
      {error && <p style={{ color: '#e11d48' }}>{error}</p>}
      
      {loading && !error && <p style={{ color: '#64748b', fontSize: 14 }}>Loading unit data...</p>}

      {/* Selected Unit Summary */}
      {selectedUnit && (
        <div style={{ border: '1px solid #e6eaf0', borderRadius: 12, padding: 12, marginBottom: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Selected Unit</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate('/deals/inventory')} style={btnPlain}>Change Unit</button>
              <button onClick={requestUnitBlock} style={btnPrimary}>Request Unit Block</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><strong>Code:</strong> {selectedUnit.code || '-'}</div>
            <div><strong>Model:</strong> {selectedUnit.model_code ? `${selectedUnit.model_code} — ${selectedUnit.model_name || ''}`.trim() : (selectedUnit.model_name || selectedUnit.unit_type || selectedUnit.unit_type_name || '-')}</div>
            <div><strong>Number:</strong> {selectedUnit.unit_number || '-'}</div>
            <div><strong>Floor:</strong> {selectedUnit.floor || '-'}</div>
            <div><strong>Building:</strong> {selectedUnit.building_number || '-'}</div>
            <div><strong>Block / Sector:</strong> {selectedUnit.block_sector || '-'}</div>
            <div><strong>Zone:</strong> {selectedUnit.zone || '-'}</div>
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eef2f7' }}>
            <h4 style={{ margin: 0, fontSize: 14, color: '#374151' }}>Price Breakdown (excl. maintenance)</h4>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 6 }}>
                  <div><small>Base</small><div>{fmt(base)} {curr}</div></div>
                  <div><small>Garden</small><div>{fmt(garden)} {curr}</div></div>
                  <div><small>Roof</small><div>{fmt(roof)} {curr}</div></div>
                  <div><small>Storage</small><div>{fmt(storage)} {curr}</div></div>
                  <div><small>Garage</small><div>{fmt(garage)} {curr}</div></div>
                  <div><small>Maintenance</small><div>{fmt(maintenance)} {curr}</div></div>
                  <div style={{ gridColumn: '1 / span 6', marginTop: 6, padding: 8, border: '1px dashed #dfe5ee', borderRadius: 8, background: '#fbfdff' }}>
                    <strong>Total excl. maintenance:</strong> {fmt(total)} {curr}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      

      

      <div style={{ border: '1px solid #e6eaf0', borderRadius: 12, overflow: 'hidden' }}>
        <CalculatorApp embedded />
      </div>

      
    </div>
  )
}

const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }
const btnPrimary = { padding: '10px 14px', borderRadius: 10, border: '1px solid #A97E34', background: '#A97E34', color: '#fff', fontWeight: 600, cursor: 'pointer' }
const btnPrimaryAlt = { padding: '10px 14px', borderRadius: 10, border: '1px solid #8B672C', background: '#8B672C', color: '#fff', fontWeight: 600, cursor: 'pointer' }
const btnPlain = { padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d9e6', background: '#fff', color: '#111827', fontWeight: 600, cursor: 'pointer' }