import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import LoadingButton from '../components/LoadingButton.jsx'
import ReservationFormModal from '../components/ReservationFormModal.jsx'
import { useLoader } from '../lib/loaderContext.jsx'
import CalculatorApp from '../App.jsx'
import * as XLSX from 'xlsx'
import { generateClientOfferPdf } from '../lib/docExports.js'
import { generateClientOfferPdf } from '../lib/docExports.js'
import DealHeaderSection from './components/DealHeaderSection.jsx'
import DealAuditTrail from './components/DealAuditTrail.jsx'
import DealActionsBar from './components/DealActionsBar.jsx'
import DealEditRequestModal from './components/DealEditRequestModal.jsx'

export default function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [deal, setDeal] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [editCalc, setEditCalc] = useState(false)
  const [savingCalc, setSavingCalc] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [calcCommissionLoading, setCalcCommissionLoading] = useState(false)
  const [dpSummary, setDpSummary] = useState(null)
  const [dpSummaryError, setDpSummaryError] = useState('')
  const [clientOfferGenerating, setClientOfferGenerating] = useState(false)
  const [contractGenerating, setContractGenerating] = useState(false)
  const { setShow, setMessage } = useLoader()
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const role = user?.role || 'user'
  const canViewUnitHistory = [
    'crm_admin',
    'financial_manager',
    'financial_admin',
    'admin',
    'superadmin',
    'ceo',
    'chairman',
    'vice_chairman',
    'top_management'
  ].includes(role)

  // Conflict visibility: other deals for the same unit (for managers)
  const [unitDeals, setUnitDeals] = useState([])

  // Reservation Form modal state
  const [reservationModalOpen, setReservationModalOpen] = useState(false)
  const [reservationForm, setReservationForm] = useState({
    date: new Date().toISOString().slice(0,10),
    preliminary: '',
    currency: '',
    language: 'en'
  })
  const [approvedReservation, setApprovedReservation] = useState(null)
  const [reservationGenerating, setReservationGenerating] = useState(false)
  const [reservationProgress, setReservationProgress] = useState(0)
  const reservationProgressTimer = useRef(null)

  // Edit request modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFields, setEditFields] = useState({
    address: false,
    payment_plan: false,
    maintenance_date: false,
    offer_dates: false,
    other: ''
  })
  const [editReason, setEditReason] = useState('')

  async function load() {
    try {
      setError('')
      const dealResp = await fetchWithAuth(`${API_URL}/api/deals/${id}`)
      const dealData = await dealResp.json()
      if (!dealResp.ok) throw new Error(dealData?.error?.message || 'Failed to load deal')
      const d = dealData.deal
      setDeal(d || null)

      const histResp = await fetchWithAuth(`${API_URL}/api/deals/${id}/history`)
      const histData = await histResp.json()
      if (!histResp.ok) throw new Error(histData?.error?.message || 'Failed to load history')
      setHistory(histData.history || [])
    } catch (e) {
      setError(e.message || String(e))
      notifyError(e, 'Failed to load deal')
    }
  }

  useEffect(() => { load() }, [id])

  // Load financial summary (Down Payment breakdown and remaining price) from server
  useEffect(() => {
    async function loadDpSummary() {
      try {
        setDpSummaryError('')
        if (!deal?.id) {
          setDpSummary(null)
          return
        }
        const resp = await fetchWithAuth(`${API_URL}/api/deals/${deal.id}/financial-summary`)
        const data = await resp.json().catch(() => null)
        if (!resp.ok) {
          const msg = data?.error?.message || 'Failed to load financial summary'
          setDpSummary(null)
          setDpSummaryError(msg)
          return
        }
        setDpSummary(data?.summary || null)
      } catch (e) {
        setDpSummary(null)
        setDpSummaryError(e?.message || String(e))
      }
    }
    loadDpSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id])

  // Load other deals for this unit (for visibility only; no locking)
  useEffect(() => {
    async function loadUnitDeals() {
      try {
        const unitId = Number(deal?.details?.calculator?.unitInfo?.unit_id) || 0
        if (!unitId) {
          setUnitDeals([])
          return
        }
        const resp = await fetchWithAuth(`${API_URL}/api/deals/by-unit/${unitId}`)
        const data = await resp.json()
        if (resp.ok && Array.isArray(data.deals)) {
          // Exclude this deal from the list for clarity
          setUnitDeals(data.deals.filter(d => d.id !== Number(id)))
        } else {
          setUnitDeals([])
        }
      } catch (e) {
        setUnitDeals([])
      }
    }
    loadUnitDeals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, deal?.details?.calculator?.unitInfo?.unit_id])

  // Load the latest approved reservation form for this deal (if any),
  // so we can prefill and lock Preliminary Payment in the Reservation Form modal.
  useEffect(() => {
    async function loadApprovedReservation() {
      try {
        if (!deal?.id) {
          setApprovedReservation(null)
          return
        }
        // Only Financial Admin / Financial Manager / elevated roles can see reservation forms.
        if (!['financial_admin', 'financial_manager', 'admin', 'superadmin'].includes(role)) {
          setApprovedReservation(null)
          return
        }
        const resp = await fetchWithAuth(`${API_URL}/api/workflow/reservation-forms?status=approved`)
        if (!resp.ok) {
          setApprovedReservation(null)
          return
        }
        const data = await resp.json().catch(() => null)
        const forms = Array.isArray(data?.reservation_forms) ? data.reservation_forms : []
        if (!forms.length) {
          setApprovedReservation(null)
          return
        }
        const dealIdNum = Number(deal.id)
        let latest = null
        for (const rf of forms) {
          const directDealId = Number(rf.deal_id)
          let detailsDealId = null
          try {
            const det = rf.details || {}
            const raw = det.deal_id
            if (raw != null) {
              const n = Number(raw)
              if (Number.isFinite(n)) detailsDealId = n
            }
          } catch {
            // ignore parse errors
          }
          const matchesDeal = (directDealId === dealIdNum) || (detailsDealId === dealIdNum)
          if (!matchesDeal) continue
          if (!latest) {
            latest = rf
          } else {
            const aTime = rf.approved_at ? new Date(rf.approved_at).getTime() : 0
            const bTime = latest.approved_at ? new Date(latest.approved_at).getTime() : 0
            if (aTime > bTime || (!aTime && rf.id > latest.id)) {
              latest = rf
            }
          }
        }
        setApprovedReservation(latest)
      } catch {
        setApprovedReservation(null)
      }
    }
    loadApprovedReservation()
  }, [deal?.id, role])

  const isOwner = deal && user && deal.created_by === user.id
  const canEdit = deal && deal.status === 'draft' && (isOwner || role === 'admin')
  const canSubmit = deal && deal.status === 'draft' && (isOwner || role === 'admin')

  const [salesList, setSalesList] = useState([])
  const [salesError, setSalesError] = useState('')
  const [policies, setPolicies] = useState([])
  const [policiesError, setPoliciesError] = useState('')
  const [expandedNotes, setExpandedNotes] = useState({})
  const [assigning, setAssigning] = useState(false)
  const [settingPolicy, setSettingPolicy] = useState(false)




  // Local state for SM override rejection prompt (id to reject)
  const [promptRejectId, setPromptRejectId] = useState(null)

  useEffect(() => {
    async function loadAux() {
      try {
        const [sres, pres] = await Promise.all([
          fetchWithAuth(`${API_URL}/api/sales?page=1&pageSize=200`).then(r => r.json()),
          fetchWithAuth(`${API_URL}/api/commission-policies?page=1&pageSize=200`).then(r => r.json())
        ])
        if (sres && sres.sales) setSalesList(sres.sales)
        if (pres && pres.policies) setPolicies(pres.policies)
      } catch (e) {
        const msg = e.message || String(e)
        setSalesError(msg)
        setPoliciesError(msg)
      }
    }
    loadAux()
  }, [])

  async function saveCalculator() {
    try {
      setSavingCalc(true)
      const snapFn = window.__uptown_calc_getSnapshot
      if (typeof snapFn !== 'function') {
        throw new Error('Calculator not ready yet.')
      }
      const snap = snapFn()
      const titleParts = []
      if (snap?.clientInfo?.buyer_name) titleParts.push(snap.clientInfo.buyer_name)
      if (snap?.unitInfo?.unit_code || snap?.unitInfo?.unit_number) {
        titleParts.push(snap.unitInfo.unit_code || snap.unitInfo.unit_number)
      }
      const title = titleParts.join(' - ') || (deal?.title || 'Deal')
      const amount = Number(snap?.generatedPlan?.totals?.totalNominal ?? snap?.stdPlan?.totalPrice ?? deal?.amount ?? 0)
      const unitType = snap?.unitInfo?.unit_type || deal?.unit_type || null
      const details = {
        calculator: { ...snap }
      }
      const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, amount, unitType, details })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to save')
      setEditCalc(false)
      notifySuccess('Deal updated successfully.')
      await load()
    } catch (e) {
      notifyError(e, 'Failed to save')
    } finally {
      setSavingCalc(false)
    }
  }

  // When starting calculator edit, hydrate the calculator from saved details (if present)
  useEffect(() => {
    if (editCalc) {
      const snap = deal?.details?.calculator
      if (snap) {
        try {
          const snapshot = {
            mode: snap.mode,
            language: snap.language,
            currency: snap.currency,
            stdPlan: snap.stdPlan,
            inputs: snap.inputs,
            firstYearPayments: snap.firstYearPayments,
            subsequentYears: snap.subsequentYears,
            clientInfo: snap.clientInfo,
            unitInfo: snap.unitInfo,
            contractInfo: snap.contractInfo,
            unitPricingBreakdown: snap.unitPricingBreakdown,
            feeSchedule: snap.feeSchedule,
            customNotes: snap.customNotes
          }
          localStorage.setItem('uptown_calc_form_state_v2', JSON.stringify(snapshot))
        } catch {}
      }
    }
  }, [editCalc, deal])

  if (error) return <p style={{ color: '#e11d48' }}>{error}</p>
  if (!deal) return <p>Loading…</p>

  const dealUnitId = Number(deal?.details?.calculator?.unitInfo?.unit_id) || null

  const schedule = deal?.details?.calculator?.generatedPlan?.schedule || []
  const totals = deal?.details?.calculator?.generatedPlan?.totals || null
  const evaluation = deal?.details?.calculator?.generatedPlan?.evaluation || null
  const snapBreakdown = deal?.details?.calculator?.unitPricingBreakdown
  const hasPricingBreakdown =
    !!snapBreakdown &&
    [
      snapBreakdown.base,
      snapBreakdown.garden,
      snapBreakdown.roof,
      snapBreakdown.storage,
      snapBreakdown.garage,
      snapBreakdown.maintenance
    ].some(v => Number(v || 0) !== 0)

  // Derive compact status/override/unit availability summary for the header
  const liveUnitStatusRaw = deal?.current_unit_status
  const liveUnitAvailable = deal?.current_unit_available
  const snapUnitStatus = deal?.details?.calculator?.unitInfo?.unit_status
  const normalizedLiveStatus = typeof liveUnitStatusRaw === 'string' ? liveUnitStatusRaw.toUpperCase() : null
  let unitAvailabilityLabel = 'Unknown'
  if (normalizedLiveStatus) {
    unitAvailabilityLabel = normalizedLiveStatus
  } else if (snapUnitStatus) {
    unitAvailabilityLabel = String(snapUnitStatus).toUpperCase()
  } else if (liveUnitAvailable === true) {
    unitAvailabilityLabel = 'AVAILABLE'
  } else if (liveUnitAvailable === false) {
    unitAvailabilityLabel = 'BLOCKED'
  }

  let overrideLabel = 'Not requested'
  if (deal?.override_approved_at) {
    overrideLabel = 'Approved by Top Management'
  } else if (deal?.needs_override) {
    overrideLabel = 'Pending (SM/FM/TM)'
  }

  const autoApprovedOnBlock = history.some(h => h.action === 'auto_approved_on_block')

  // Shared badge colors (aligned with Dashboard/Inventory lists)
  const palette = {
    green: '#16a34a',
    blue: '#2563eb',
    red: '#dc2626',
    gray: '#64748b'
  }

  const dealStatusLabel = deal?.status || ''
  const dealStatusUpper = dealStatusLabel.toString().toUpperCase()
  let dealStatusColor = palette.gray
  if (dealStatusUpper === 'APPROVED') dealStatusColor = palette.green
  else if (dealStatusUpper === 'PENDING_APPROVAL') dealStatusColor = palette.blue
  else if (dealStatusUpper === 'REJECTED') dealStatusColor = palette.red

  const unitStatusUpper = unitAvailabilityLabel.toString().toUpperCase()
  let unitStatusColor = palette.gray
  if (unitStatusUpper === 'AVAILABLE') unitStatusColor = palette.green
  else if (unitStatusUpper === 'BLOCKED') unitStatusColor = palette.red
  else if (unitStatusUpper && unitStatusUpper !== 'UNKNOWN') unitStatusColor = palette.blue

  const overrideUpper = overrideLabel.toString().toUpperCase()
  let overrideColor = palette.gray
  if (overrideUpper.indexOf('APPROVED') !== -1) overrideColor = palette.green
  else if (overrideUpper.indexOf('PENDING') !== -1) overrideColor = palette.blue

  async function generateDocFromSaved(documentType) {
    try {
      const snap = deal?.details?.calculator
      if (!snap) {
        notifyError('No saved calculator details found.')
        return
      }
      const body = {
        documentType,
        deal_id: Number(deal.id),
        language: snap.language,
        currency: snap.currency,
        mode: snap.mode,
        stdPlan: snap.stdPlan,
        inputs: snap.inputs,
        generatedPlan: snap.generatedPlan,
        data: {
          offer_date: snap?.inputs?.offerDate || new Date().toISOString().slice(0, 10),
          first_payment_date: snap?.inputs?.firstPaymentDate || snap?.inputs?.offerDate || new Date().toISOString().slice(0, 10)
        }
      }
      // Show full-page loader for this heavy operation
      const label = documentType === 'pricing_form'
        ? 'Generating Pricing Form…'
        : documentType === 'reservation_form'
        ? 'Generating Reservation Form…'
        : documentType === 'contract'
        ? 'Generating Contract…'
        : 'Generating document…'
      setMessage(label)
      setShow(true)

      const resp = await fetchWithAuth(`${API_URL}/api/generate-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!resp.ok) {
        let errMsg = 'Failed to generate document'
        try {
          const j = await resp.json()
          errMsg = j?.error?.message || errMsg
        } catch {}
        notifyError(errMsg)
        return
      }
      const blob = await resp.blob()
      const cd = resp.headers.get('Content-Disposition') || ''
      const match = /filename\*=UTF-8''([^;]+)|filename=\\"?([^\\";]+)\\"?/i.exec(cd)
      let filename = ''
      if (match) filename = decodeURIComponent(match[1] || match[2] || '')
      if (!filename) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        filename = `${documentType}_${ts}.pdf`
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notifySuccess('Document generated successfully.')
    } catch (e) {
      notifyError(e, 'Failed to generate document')
    } finally {
      setShow(false)
    }
  }

  function printSchedule() {
    const win = window.open('', 'printwin')
    if (!win) return
    const rows = schedule.map((r, i) => `
      <tr>
        <td class="p-2 border border-gray-200">${i + 1}</td>
        <td class="p-2 border border-gray-200">${r.month}</td>
        <td class="p-2 border border-gray-200">${r.label}</td>
        <td class="p-2 border border-gray-200 text-right">${Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="p-2 border border-gray-200">${r.writtenAmount || ''}</td>
      </tr>
    `).join('')
    const totalHtml = totals ? `
      <tfoot>
        <tr>
          <td colspan="3" class="p-2 border border-gray-200 text-right font-bold">Total</td>
          <td class="p-2 border border-gray-200 text-right font-bold">
            ${Number(totals.totalNominal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td class="p-2 border border-gray-200"></td>
        </tr>
      </tfoot>
    ` : ''
    win.document.write(`
      <html>
      <head>
        <title>Deal #${deal?.id} — Payment Schedule</title>
        <meta charset="utf-8"/>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: Inter, sans-serif; padding: 16px; color: #111827; }
        </style>
      </head>
      <body>
        <h1 class="text-xl font-bold mb-4">Deal #${deal?.id} — ${deal?.title || ''}</h1>
        <p class="mb-4"><strong>Status:</strong> ${deal?.status || ''} &nbsp; <strong>Unit Type:</strong> ${deal?.unit_type || '-'}</p>
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="bg-gray-50 text-left">
              <th class="p-2 border border-gray-200">#</th><th class="p-2 border border-gray-200">Month</th><th class="p-2 border border-gray-200">Label</th><th class="p-2 border border-gray-200 text-right">Amount</th><th class="p-2 border border-gray-200">Written Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          ${totalHtml}
        </table>
        <script>window.onload = function(){ window.print(); }</script>
      </body>
      </html>
    `)
    win.document.close()
  }

  function generateChecksSheetFromSaved() {
    const snap = deal?.details?.calculator
    const plan = snap?.generatedPlan
    if (!plan || !Array.isArray(plan.schedule) || plan.schedule.length === 0) {
      notifyError('No saved schedule found to generate checks sheet.')
      return
    }
    const buyer = snap?.clientInfo?.buyer_name || ''
    const unit = snap?.unitInfo?.unit_code || snap?.unitInfo?.unit_number || ''
    const curr = snap?.currency || ''

    // Contract metadata
    const ci = snap?.contractInfo || {}
    const notes = snap?.customNotes || {}
    const fmt = (d) => d ? new Date(d).toLocaleDateString() : ''
    const money = (v) => {
      const n = Number(v || 0)
      return isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
    }

    const metaLines = [
      `Buyer: ${buyer}    Unit: ${unit}    Currency: ${curr}`,
      `Contract Date: ${fmt(ci.contract_date)}    Reservation Form Date: ${fmt(ci.reservation_form_date)}`,
      `Reservation Payment: ${money(ci.reservation_payment_amount)} on ${fmt(ci.reservation_payment_date)}`,
      `Maintenance Fee: ${money(ci.maintenance_fee)}    Delivery Period: ${ci.delivery_period || ''}`,
    ]

    const extraNotes = []
    if (notes.dp_explanation) extraNotes.push(`DP Notes: ${notes.dp_explanation}`)
    if (notes.poa_clause) extraNotes.push(`POA: ${notes.poa_clause}`)

    const headerRows = [
      ['Checks Sheet'],
      ...metaLines.map(line => [line]),
      ...(extraNotes.length ? extraNotes.map(line => [line]) : []),
      [],
      ['#', 'Cheque No.', 'Date', 'Pay To', 'Amount', 'Amount in Words', 'Notes']
    ]
    const bodyRows = (plan.schedule || []).map((row, i) => {
      const amount = Number(row.amount || 0)
      const amountStr = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return [
        i + 1,
        '',
        '',
        buyer,
        amountStr,
        row.writtenAmount || '',
        `${row.label} (Month ${row.month})`
      ]
    })

    const aoa = [...headerRows, ...bodyRows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 60 },
      { wch: 30 },
    ]

    // Merge all header/meta lines across A..G
    const mergeCount = 1 /* title */ + metaLines.length + extraNotes.length
    const merges = []
    for (let r = 0; r < mergeCount; r++) {
      merges.push({ s: { r, c: 0 }, e: { r, c: 6 } })
    }
    ws['!merges'] = merges

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Checks')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    a.download = `checks_sheet_${ts}.xlsx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    notifySuccess('Checks sheet generated')
  }

  return (
    <div>
      <DealHeaderSection
        deal={deal}
        dealUnitId={dealUnitId}
        canViewUnitHistory={canViewUnitHistory}
        unitDeals={unitDeals}
        dealStatusLabel={dealStatusLabel}
        dealStatusColor={dealStatusColor}
        overrideLabel={overrideLabel}
        overrideColor={overrideColor}
        unitAvailabilityLabel={unitAvailabilityLabel}
        unitStatusColor={unitStatusColor}
        autoApprovedOnBlock={autoApprovedOnBlock}
        hasPricingBreakdown={hasPricingBreakdown}
        role={role}
        onBack={() => navigate('/deals')}
        onViewUnitDeals={dealUnitId ? () => navigate(`/deals?unitId=${dealUnitId}`) : undefined}
        onViewUnitHistory={
          dealUnitId && canViewUnitHistory
            ? () => navigate(`/admin/unit-history?unitId=${dealUnitId}`)
            : undefined
        }
      />

      {!editCalc ? (
        <div className="mb-4">
          {/* Property Consultant (offer creator) -- previously labeled "Sales Rep" */}
          <div className="flex gap-2 items-center my-2">
            <strong className="text-gray-900">Property Consultant:</strong>
            {role !== 'admin' && role !== 'superadmin' ? (
              <span className="text-gray-700">
                {deal.created_by_email || deal.created_by}
                {!deal.sales_rep_id && ' (used for commission by default)'}
              </span>
            ) : (
              <select
                disabled={!canEdit || assigning}
                value={deal.sales_rep_id || ''}
                onChange={async (e) => {
                  const salesRepId = e.target.value ? Number(e.target.value) : null
                  setAssigning(true)
                  setDeal(d => ({ ...d, sales_rep_id: salesRepId }))
                  try {
                    const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ salesRepId })
                    })
                    const data = await resp.json()
                    if (!resp.ok) {
                      notifyError(data?.error?.message || 'Failed to assign property consultant')
                      setDeal(d => ({ ...d, sales_rep_id: deal.sales_rep_id || null }))
                    } else {
                      notifySuccess('Property consultant assignment updated.')
                    }
                  } catch (err) {
                    notifyError(err, 'Failed to assign property consultant')
                    setDeal(d => ({ ...d, sales_rep_id: deal.sales_rep_id || null }))
                  } finally {
                    setAssigning(false)
                  }
                }}
                className="p-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-primary focus:ring focus:ring-primary/20 outline-none"
              >
                <option value="">— Use Offer Creator (default) —</option>
                {salesList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.email ? `(${s.email})` : ''}
                  </option>
                ))}
              </select>
            )}
            {salesError ? <small className="text-red-600">{salesError}</small> : null}
          </div>

          <div className="flex gap-2 items-center my-2">
            <strong className="text-gray-900">Commission Policy:</strong>
            <select
              disabled={!canEdit || settingPolicy}
              value={deal.policy_id || ''}
              onChange={async (e) => {
                const policyId = e.target.value ? Number(e.target.value) : null
                setSettingPolicy(true)
                setDeal(d => ({ ...d, policy_id: policyId }))
                try {
                  const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ policyId })
                  })
                  const data = await resp.json()
                  if (!resp.ok) {
                    notifyError(data?.error?.message || 'Failed to set policy')
                    setDeal(d => ({ ...d, policy_id: deal.policy_id || null }))
                  } else {
                    notifySuccess('Commission policy updated successfully.')
                  }
                } catch (err) {
                  notifyError(err, 'Failed to set policy')
                  setDeal(d => ({ ...d, policy_id: deal.policy_id || null }))
                } finally {
                  setSettingPolicy(false)
                }
              }}
              className="p-2 rounded-lg border border-gray-300 bg-white text-sm focus:border-primary focus:ring focus:ring-primary/20 outline-none"
            >
              <option value="">— Use Active Policy —</option>
              {policies.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.active ? '' : '(inactive)'}
                </option>
              ))}
            </select>
            {policiesError ? <small className="text-red-600">{policiesError}</small> : null}
          </div>

          <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Payment Schedule</h3>
          <div className="flex flex-wrap gap-4 p-3 bg-stone-50 border border-stone-200 rounded-lg mb-4 text-sm">
            <div>
              <strong className="text-gray-900">Offer Date:</strong>{' '}
              {deal?.details?.calculator?.inputs?.offerDate ||
                new Date().toISOString().slice(0, 10)}
            </div>
            <div>
              <strong className="text-gray-900">First Payment Date:</strong>{' '}
              {deal?.details?.calculator?.inputs?.firstPaymentDate ||
                deal?.details?.calculator?.inputs?.offerDate ||
                new Date().toISOString().slice(0, 10)}
            </div>
          </div>

          {dpSummary && (
            <div className="flex flex-wrap gap-4 p-3 mb-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-900">
              <div>
                <strong className="font-semibold">Total Price (excl. maintenance):</strong>{' '}
                {Number(dpSummary.total_excl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </div>
              <div>
                <strong className="font-semibold">Maintenance Deposit:</strong>{' '}
                {Number(dpSummary.maintenance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </div>
              <div>
                <strong className="font-semibold">Total Price (incl. maintenance):</strong>{' '}
                {Number(dpSummary.total_incl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </div>
              <div>
                <strong className="font-semibold">Total Down Payment:</strong>{' '}
                {Number(dpSummary.dp_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </div>
              <div>
                <strong className="font-semibold">Preliminary Payment:</strong>{' '}
                {Number(dpSummary.dp_preliminary_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
                {dpSummary.dp_preliminary_date && (
                  <> ({new Date(dpSummary.dp_preliminary_date).toLocaleDateString()})</>
                )}
              </div>
              <div>
                <strong className="font-semibold">Paid from Down Payment:</strong>{' '}
                {Number(dpSummary.dp_paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
                {dpSummary.dp_paid_date && (
                  <> ({new Date(dpSummary.dp_paid_date).toLocaleDateString()})</>
                )}
              </div>
              <div>
                <strong className="font-semibold">Remaining Down Payment:</strong>{' '}
                {Number(dpSummary.dp_remaining || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </div>
              <div>
                <strong className="font-semibold">Remaining Price after Down Payment:</strong>{' '}
                {Number(dpSummary.remaining_after_dp || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
              </div>
            </div>
          )}

          {schedule.length === 0 ? (
            <p className="text-gray-500 italic">
              No saved schedule. Use Edit Offer to generate and save one.
            </p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl mb-4">
              <table className="w-full border-collapse text-sm text-left">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 border-r border-gray-100">#</th>
                    <th className="px-4 py-3 border-r border-gray-100">Month</th>
                    <th className="px-4 py-3 border-r border-gray-100">Label</th>
                    <th className="px-4 py-3 text-right border-r border-gray-100">Amount</th>
                    <th className="px-4 py-3">Written Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedule.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 border-r border-gray-100">{idx + 1}</td>
                      <td className="px-4 py-2 border-r border-gray-100">{row.month}</td>
                      <td className="px-4 py-2 border-r border-gray-100">{row.label}</td>
                      <td className="px-4 py-2 text-right border-r border-gray-100 font-mono text-gray-800">
                        {Number(row.amount || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{row.writtenAmount}</td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot className="bg-gray-50 font-bold text-gray-900 border-t border-gray-200">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-3 text-right border-r border-gray-100"
                      >
                        Total
                      </td>
                      <td className="px-4 py-3 text-right border-r border-gray-100">
                        {Number(totals.totalNominal || 0).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2 }
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {evaluation && (
            <div className="mt-6 border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mt-0 mb-4">Acceptance Evaluation</h3>
              {(() => {
                const ok = evaluation.decision === 'ACCEPT'
                const boxClass = `mb-4 px-4 py-3 rounded-lg border font-semibold ${
                  ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
                }`
                return (
                  <div className={boxClass}>
                    NPV-based Decision: {evaluation.decision}
                  </div>
                )
              })()}

              {/* Compact badges: Financial decision + deal override status */}
              {(() => {
                const badges = []
                const badge = (bg, color, text) => (
                  <span key={text} className={`px-2.5 py-1 rounded-full text-xs font-semibold mr-2 bg-[${bg}] text-[${color}]`} style={{ backgroundColor: bg, color: color }}>{text}</span>
                )
                const fin = String(evaluation?.decision || '').toUpperCase()
                if (fin === 'ACCEPT') badges.push(badge('#ecfdf5', '#065f46', 'Financial: ACCEPT'))
                else if (fin === 'REJECT') badges.push(badge('#fef2f2', '#991b1b', 'Financial: REJECT'))

                const ovApproved = !!deal?.override_approved_at
                const needsOv = !!deal?.needs_override
                if (ovApproved) badges.push(badge('#ecfdf5', '#065f46', 'Override: Approved (TM)'))
                else if (needsOv) badges.push(badge('#eff6ff', '#1e40af', 'Override: Pending'))

                return badges.length ? <div className="mb-4">{badges}</div> : null
              })()}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50/50">
                  <strong className="block mb-2 text-gray-700">PV Comparison</strong>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Proposed PV: <span className="font-mono text-gray-800">{Number(evaluation.pv?.proposedPV || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></li>
                    <li>Standard PV: <span className="font-mono text-gray-800">{Number(evaluation.pv?.standardPV || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></li>
                    <li>Difference (Std - Prop): <span className={`font-mono font-medium ${evaluation.pv?.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>{Number(evaluation.pv?.difference || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></li>
                    <li>Status: <span className={`font-bold ${evaluation.pv?.pass ? 'text-green-700' : 'text-red-700'}`}>{evaluation.pv?.pass ? 'PASS' : 'FAIL'}</span></li>
                  </ul>
                </div>
                <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50/50">
                  <strong className="block mb-2 text-gray-700">Conditions</strong>
                  <ul className="list-none m-0 pl-0 space-y-2 text-sm">
                    {evaluation.conditions?.map((c, idx) => (
                      <li key={idx}>
                        <div className="flex justify-between items-baseline border-b border-dashed border-gray-200 pb-1 mb-1">
                          <strong className="text-gray-800 mr-2">{c.label}</strong>
                          <span className={`font-bold text-xs px-1.5 py-0.5 rounded ${c.status === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span>
                        </div>
                        {'required' in c && typeof c.required === 'number' && <div className="text-gray-500 text-xs">Required: {Number(c.required).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                        {'required' in c && typeof c.required === 'object' && (
                          <div className="text-gray-500 text-xs">
                            Required: {c.required.min != null ? `Min ${Number(c.required.min).toLocaleString()}% ` : ''}{c.required.max != null ? `Max ${Number(c.required.max).toLocaleString()}%` : ''}
                          </div>
                        )}
                        {'actual' in c && typeof c.actual === 'number' && <div className="text-gray-500 text-xs">Actual: {Number(c.actual).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                        {'actual' in c && typeof c.actual === 'object' && (
                          <div className="text-gray-500 text-xs">
                            Actual: {c.actual.amount != null ? `${Number(c.actual.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}{c.actual.percent != null ? ` (${Number(c.actual.percent).toLocaleString(undefined, { maximumFractionDigits: 2 })}%)` : ''}
                          </div>
                        )}
                        {c.handoverYear != null && <div className="text-gray-500 text-xs">Handover Year: {c.handoverYear}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Override Workflow — visible when evaluation REJECT */}
              {evaluation.decision === 'REJECT' && (
                <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                  <strong className="block mb-4 text-gray-900">Override Workflow</strong>

                  {/* Stage timeline: Request → SM → FM → TM */}
                  {(() => {
                    const stages = [
                      { key: 'requested', label: 'Requested', ts: deal?.override_requested_at, title: deal?.override_requested_at ? `Requested at ${new Date(deal.override_requested_at).toLocaleString()}` : 'Requested (pending)' },
                      { key: 'sm', label: 'Sales Manager', ts: deal?.manager_review_at, title: deal?.manager_review_at ? `SM reviewed at ${new Date(deal.manager_review_at).toLocaleString()} by ${deal?.manager_review_by_name || ''} (${deal?.manager_review_by_role || ''})` : 'Sales Manager (pending)' },
                      { key: 'fm', label: 'Financial Manager', ts: deal?.fm_review_at, title: deal?.fm_review_at ? `FM reviewed at ${new Date(deal.fm_review_at).toLocaleString()} by ${deal?.fm_review_by_name || ''} (${deal?.fm_review_by_role || ''})` : 'Financial Manager (pending)' },
                      { key: 'tm', label: 'Top Management', ts: deal?.override_approved_at, title: deal?.override_approved_at ? `TM decision at ${new Date(deal.override_approved_at).toLocaleString()} by ${deal?.override_approved_by_name || ''} (${deal?.override_approved_by_role || ''})` : 'Top Management (pending)' }
                    ]
                    const activeIdx = stages.findIndex(s => !!s.ts)
                    return (
                      <div className="flex items-center gap-2 mt-2 w-full">
                        {stages.map((s, i) => (
                          <React.Fragment key={s.key}>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <div className={`w-4 h-4 rounded-full border-2 ${i <= activeIdx ? 'bg-primary border-primary' : 'bg-gray-200 border-gray-300'}`} title={s.title} />
                              <div className={`text-xs ${i <= activeIdx ? 'text-primary font-semibold' : 'text-gray-500'}`} title={s.title}>
                                {s.label}{s.ts ? ` (${new Date(s.ts).toLocaleDateString()})` : ''}
                              </div>
                            </div>
                            {i < stages.length - 1 && <div className={`h-0.5 flex-1 ${i < activeIdx ? 'bg-primary' : 'bg-gray-200'}`} />}
                          </React.Fragment>
                        ))}
                      </div>
                    )
                  })()}

                  <div className="mt-2 text-xs text-gray-500">
                    Request → Sales Manager review → Financial Manager review → Top Management decision
                  </div>
                  <div className="flex gap-2 flex-wrap mt-3">
                    {(role === 'property_consultant' || role === 'admin' || role === 'superadmin') && (
                      <LoadingButton
                        onClick={async () => {
                          const reason = window.prompt('Provide a reason for override request (optional):', '')
                          try {
                            const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/request-override`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ reason: reason || '' })
                            })
                            const data = await resp.json()
                            if (!resp.ok) notifyError(data?.error?.message || 'Failed to request override')
                            else { notifySuccess('Override requested. Waiting for Sales Manager review.'); await load() }
                          } catch (err) {
                            notifyError(err, 'Failed to request override')
                          }
                        }}
                        variant="primary"
                      >
                        Request Override
                      </LoadingButton>
                    )}
                    {(role === 'sales_manager' || role === 'admin' || role === 'superadmin') && (
                      <>
                        <LoadingButton
                          onClick={async () => {
                            const notes = window.prompt('Notes (optional):', '')
                            try {
                              const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/override-sm-approve`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ notes: notes || '' })
                              })
                              const data = await resp.json()
                              if (!resp.ok) notifyError(data?.error?.message || 'Failed to approve override')
                              else { notifySuccess('Override approved (SM). Forwarded to FM.'); await load() }
                            } catch (err) {
                              notifyError(err, 'Failed to approve override')
                            }
                          }}
                        >
                          SM Approve
                        </LoadingButton>
                        <LoadingButton
                          onClick={() => setPromptRejectId(id)}
                          style={{ marginLeft: 8 }}
                        >
                          SM Reject
                        </LoadingButton>
                      </>
                    )}
                    {(role === 'financial_manager' || role === 'admin' || role === 'superadmin') && (
                      <>
                        <LoadingButton
                          onClick={async () => {
                            const notes = window.prompt('Notes (optional):', '')
                            try {
                              const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/override-fm-approve`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ notes: notes || '' })
                              })
                              const data = await resp.json()
                              if (!resp.ok) notifyError(data?.error?.message || 'Failed to approve override')
                              else { notifySuccess('Override approved (FM). Forwarded to Top Management.'); await load() }
                            } catch (err) {
                              notifyError(err, 'Failed to approve override')
                            }
                          }}
                        >
                          FM Approve
                        </LoadingButton>
                        <LoadingButton
                          onClick={async () => {
                            const notes = window.prompt('Rejection reason (optional):', '')
                            try {
                              const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/override-fm-reject`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ notes: notes || '' })
                              })
                              const data = await resp.json()
                              if (!resp.ok) notifyError(data?.error?.message || 'Failed to reject override')
                              else { notifySuccess('Override rejected (FM).'); await load() }
                            } catch (err) {
                              notifyError(err, 'Failed to reject override')
                            }
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          FM Reject
                        </LoadingButton>
                      </>
                    )}
                    {(role === 'ceo' || role === 'chairman' || role === 'vice_chairman' || role === 'top_management' || role === 'admin' || role === 'superadmin') && (
                      <>
                        <LoadingButton
                          onClick={async () => {
                            const notes = window.prompt('Approval notes (optional):', '')
                            try {
                              const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/override-approve`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ notes: notes || '' })
                              })
                              const data = await resp.json()
                              if (!resp.ok) notifyError(data?.error?.message || 'Failed to approve override')
                              else { notifySuccess('Override approved (TM).'); await load() }
                            } catch (err) {
                              notifyError(err, 'Failed to approve override')
                            }
                          }}
                        >
                          TM Approve
                        </LoadingButton>
                        <LoadingButton
                          onClick={async () => {
                            const notes = window.prompt('Rejection reason (optional):', '')
                            try {
                              const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/override-reject`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ notes: notes || '' })
                              })
                              const data = await resp.json()
                              if (!resp.ok) notifyError(data?.error?.message || 'Failed to reject override')
                              else { notifySuccess('Override rejected (TM).'); await load() }
                            } catch (err) {
                              notifyError(err, 'Failed to reject override')
                            }
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          TM Reject
                        </LoadingButton>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mt-4 text-sm text-gray-500"><strong>Created By:</strong> {deal.created_by_email || deal.created_by}</p>
          <p className="text-sm text-gray-500"><strong>Created At:</strong> {deal.created_at ? new Date(deal.created_at).toLocaleString() : ''}</p>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-2">
            <h3 className="text-lg font-bold text-gray-800 m-0">Edit Offer</h3>
            <div className="flex gap-2">
              <LoadingButton onClick={saveCalculator} loading={savingCalc} variant="primary">Save</LoadingButton>
              <LoadingButton onClick={() => setEditCalc(false)} disabled={savingCalc}>Cancel</LoadingButton>
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <CalculatorApp embedded dealId={deal.id} />
          </div>
        </div>
      )}

      {/* Outstanding edit request banner */}
      {/* Outstanding edit request banner */}
      {(() => {
        // Find last request_edits and last edits_addressed in history
        const lastReqIdx = [...history].reverse().findIndex(h => h.action === 'request_edits')
        const lastAddrIdx = [...history].reverse().findIndex(h => h.action === 'edits_addressed')
        const outstanding = lastReqIdx !== -1 && (lastAddrIdx === -1 || lastAddrIdx > lastReqIdx)
        if (!outstanding) return null
        const isConsultant = role === 'property_consultant' || role === 'sales_manager'
        
        return (
          <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-xl p-4 mb-6 shadow-sm">
            <div className="font-bold mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">edit_note</span>
              Edits Requested
            </div>
            <div className="text-sm">Financial team has requested edits to this deal. Please review and update the allowed fields (payment plan, address, etc.). Identity and unit data remain locked.</div>
            {isConsultant && (
              <div className="mt-3">
                <LoadingButton
                  onClick={async () => {
                    const notes = window.prompt('Optional note to confirm edits addressed:', '')
                    try {
                      const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/edits-addressed`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notes: notes || '' })
                      })
                      const data = await resp.json().catch(() => null)
                      if (!resp.ok) {
                        notifyError(data?.error?.message || 'Failed to mark edits addressed')
                      } else {
                        notifySuccess('Marked edits addressed.')
                        await load()
                      }
                    } catch (err) {
                      notifyError(err, 'Failed to mark edits addressed')
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white border-transparent"
                >
                  Mark Edits Addressed
                </LoadingButton>
              </div>
            )}
          </div>
        )
      })()}

      {/* Actions — restrict printing offer until approved */}
      <DealActionsBar
        deal={deal}
        role={role}
        canEdit={canEdit}
        canSubmit={canSubmit}
        editCalc={editCalc}
        evaluation={evaluation}
        approvedReservation={approvedReservation}
        reservationModalOpen={reservationModalOpen}
        reservationGenerating={reservationGenerating}
        reservationProgress={reservationProgress}
        calcCommissionLoading={calcCommissionLoading}
        onToggleEditCalc={() => setEditCalc(true)}
        onSubmitDeal={async () => {
          try {
            setSubmitting(true)
            const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/submit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            })
            const data = await resp.json()
            if (!resp.ok) throw new Error(data?.error?.message || 'Failed to submit deal')
            notifySuccess('Deal submitted for approval.')
            await load()
          } catch (e) {
            notifyError(e, 'Failed to submit deal')
          } finally {
            setSubmitting(false)
          }
        }}
        onApproveDealAsSM={async () => {
          try {
            setSubmitting(true)
            const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/approve-sm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            })
            const data = await resp.json()
            if (!resp.ok) throw new Error(data?.error?.message || 'Failed to approve deal')
            notifySuccess('Deal approved as Sales Manager.')
            await load()
          } catch (e) {
            notifyError(e, 'Failed to approve deal')
          } finally {
            setSubmitting(false)
          }
        }}
        onRequestOverride={async () => {
          try {
            const reason = window.prompt('Reason for override request:', '') || ''
            if (!reason.trim()) {
              notifyError('Override reason is required.')
              return
            }
            setSubmitting(true)
            const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/request-override`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason })
            })
            const data = await resp.json()
            if (!resp.ok) throw new Error(data?.error?.message || 'Failed to request override')
            notifySuccess('Override request submitted to management.')
            await load()
          } catch (e) {
            notifyError(e, 'Failed to request override')
          } finally {
            setSubmitting(false)
          }
        }}

        onGenerateClientOfferPdf={async () => {
          try {
            const snap = deal?.details?.calculator
            const plan = snap?.generatedPlan
            const scheduleLocal = plan?.schedule || []
            if (!plan || !scheduleLocal.length) {
              notifyError(
                'No saved payment schedule found. Use Edit Offer to generate and save a plan first.'
              )
              return
            }
            const totalsLocal = plan.totals || {
              totalNominal: scheduleLocal.reduce(
                (s, e) => s + (Number(e.amount) || 0),
                0
              )
            }
            const ci = snap?.clientInfo || {}
            const numBuyersRaw = Number(ci.number_of_buyers)
            const numBuyers = Math.min(Math.max(numBuyersRaw || 1, 1), 4)
            const buyers = []
            for (let i = 1; i <= numBuyers; i++) {
              const sfx = i === 1 ? '' : `_${i}`
              buyers.push({
                buyer_name: ci[`buyer_name${sfx}`] || '',
                phone_primary: ci[`phone_primary${sfx}`] || '',
                phone_secondary: ci[`phone_secondary${sfx}`] || '',
                email: ci[`email${sfx}`] || ''
              })
            }

            const snapBreakdownLocal = snap?.unitPricingBreakdown
            const body = {
              language: snap?.language || 'en',
              currency: snap?.currency || 'EGP',
              buyers,
              schedule: scheduleLocal,
              totals: totalsLocal,
              offer_date:
                snap?.inputs?.offerDate ||
                new Date().toISOString().slice(0, 10),
              first_payment_date:
                snap?.inputs?.firstPaymentDate ||
                snap?.inputs?.offerDate ||
                new Date().toISOString().slice(0, 10),
              unit: {
                unit_code: snap?.unitInfo?.unit_code || '',
                unit_type: snap?.unitInfo?.unit_type || '',
                unit_id: Number(snap?.unitInfo?.unit_id) || null
              }
            }

            if (snapBreakdownLocal) {
              body.unit_pricing_breakdown = {
                base: Number(snapBreakdownLocal.base || 0),
                garden: Number(snapBreakdownLocal.garden || 0),
                roof: Number(snapBreakdownLocal.roof || 0),
                storage: Number(snapBreakdownLocal.storage || 0),
                garage: Number(snapBreakdownLocal.garage || 0),
                maintenance: Number(snapBreakdownLocal.maintenance || 0),
                totalExclMaintenance: Number(
                  snapBreakdownLocal.totalExclMaintenance || 0
                )
              }
            }

            const { blob, filename } = await generateClientOfferPdf(
              body,
              API_URL
            )
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            notifySuccess('Client Offer PDF exported successfully.')
          } catch (e) {
            notifyError(e, 'Failed to export Client Offer PDF')
          }
        }}
        onBlockOrUnblockUnit={async () => {
          const snap = deal?.details?.calculator
          const savedUnitInfo = snap?.unitInfo || {}
          const unitId = Number(savedUnitInfo.unit_id) || null

          if (!unitId) {
            return
          }

          const liveStatus = deal?.current_unit_status
          const liveAvailable = deal?.current_unit_available
          const normalizedLiveStatus =
            typeof liveStatus === 'string' ? liveStatus.toUpperCase() : null

          const snapshotBlocked =
            savedUnitInfo.unit_status === 'BLOCKED' ||
            savedUnitInfo.available === false
          const liveBlocked =
            normalizedLiveStatus === 'BLOCKED' || liveAvailable === false

          const isBlocked = liveBlocked || snapshotBlocked

          const decision = evaluation?.decision || null
          const overrideApproved = !!deal?.override_approved_at
          const canBlockOrUnblockLocal =
            !!unitId && (decision === 'ACCEPT' || overrideApproved)

          const label = isBlocked
            ? 'Request Unit Unblock'
            : 'Request Unit Block'
          const title = canBlockOrUnblockLocal
            ? isBlocked
              ? 'Request to unblock this unit'
              : 'Request a block on this unit'
            : 'Available after plan is ACCEPTED or override is approved (and unit is linked to this deal)'

          if (!canBlockOrUnblockLocal) {
            notifyError(title)
            return
          }

          try {
            if (isBlocked) {
              const reason =
                window.prompt(
                  'Reason for unblock request (optional):',
                  ''
                ) || ''
              const resp = await fetchWithAuth(
                `${API_URL}/api/blocks/request-unblock`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ unitId, reason })
                }
              )
              const data = await resp.json()
              if (!resp.ok) {
                notifyError(
                  data?.error?.message || 'Failed to request unit unblock'
                )
              } else {
                notifySuccess(
                  'Unblock request submitted. Waiting for Financial Manager review.'
                )
              }
            } else {
              const durationStr = window.prompt(
                'Block duration in days (default 7):',
                '7'
              )
              if (durationStr === null) return
              const durationDays = Number(durationStr) || 7
              const reason =
                window.prompt('Reason for block (optional):', '') || ''
              const resp = await fetchWithAuth(
                `${API_URL}/api/blocks/request`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ unitId, durationDays, reason })
                }
              )
              const data = await resp.json()
              if (!resp.ok) {
                notifyError(
                  data?.error?.message || 'Failed to request unit block'
                )
              } else {
                notifySuccess('Block request submitted for approval.')
              }
            }
          } catch (err) {
            notifyError(
              err,
              isBlocked
                ? 'Failed to request unit unblock'
                : 'Failed to request unit block'
            )
          }
        }}
        onOpenReservationModal={() => setReservationModalOpen(true)}
        onCloseReservationModal={() => setReservationModalOpen(false)}
        onGenerateReservationFormPdf={async (opts) => {
          let timer = null
          try {
            setReservationGenerating(true)
            setReservationProgress(10)
            timer = setInterval(() => {
              setReservationProgress(prev => (prev >= 90 ? prev : prev + 5))
            }, 300)

            setMessage('Generating Reservation Form…')
            setShow(true)
            const resp = await fetchWithAuth(
              `${API_URL}/api/documents/reservation-form`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  deal_id: Number(deal.id),
                  ...opts
                })
              }
            )
            if (!resp.ok) {
              let errMsg = 'Failed to generate reservation form'
              try {
                const j = await resp.json()
                errMsg = j?.error?.message || errMsg
              } catch {}
              notifyError(errMsg)
              return
            }
            const blob = await resp.blob()
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            const filename = `reservation_form_${ts}.pdf`
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            setReservationProgress(100)
            setReservationModalOpen(false)
            notifySuccess('Reservation Form generated successfully.')
          } catch (err) {
            notifyError(err, 'Failed to generate reservation form')
          } finally {
            if (timer) clearInterval(timer)
            setReservationGenerating(false)
            setTimeout(() => setReservationProgress(0), 800)
            setShow(false)
          }
        }}
        onRequestEdits={() => setShowEditModal(true)}
        onGenerateContractPdf={async () => {
          try {
            setContractGenerating(true)
            await generateDocFromSaved('contract')
          } finally {
            setContractGenerating(false)
          }
        }}
        onGenerateChecksSheet={generateChecksSheetFromSaved}
        onCalculateCommission={async () => {
          const salesPersonId = deal.sales_rep_id || deal.created_by
          if (!salesPersonId) {
            notifyError('Missing Property Consultant for this deal.')
            return
          }
          setCalcCommissionLoading(true)
          try {
            const resp = await fetchWithAuth(
              `${API_URL}/api/commissions/calc-and-save`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  deal_id: deal.id,
                  sales_person_id: salesPersonId
                })
              }
            )
            const data = await resp.json()
            if (!resp.ok) {
              notifyError(
                data?.error?.message || 'Failed to calculate commission'
              )
            } else {
              notifySuccess(
                `Commission calculated: ${Number(
                  data.commission.amount || 0
                ).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              )
              await load()
            }
          } catch (err) {
            notifyError(err, 'Failed to calculate commission')
          } finally {
            setCalcCommissionLoading(false)
          }
        }}
        clientOfferGenerating={clientOfferGenerating}
        contractGenerating={contractGenerating}
      />

      <DealAuditTrail
        history={history}
        expandedNotes={expandedNotes}
        onToggleNote={(noteId) =>
          setExpandedNotes(s => ({ ...s, [noteId]: !s[noteId] }))
        }
      />

      <DealEditRequestModal
        open={showEditModal}
        editFields={editFields}
        editReason={editReason}
        onChangeFields={setEditFields}
        onChangeReason={setEditReason}
        onCancel={() => {
          setShowEditModal(false)
          setEditFields({
            address: false,
            payment_plan: false,
            maintenance_date: false,
            offer_dates: false,
            other: ''
          })
          setEditReason('')
        }}
        onSubmit={async () => {
          const fields = ['address', 'payment_plan', 'maintenance_date', 'offer_dates'].filter(
            k => editFields[k]
          )
          if (editFields.other && editFields.other.trim()) {
            fields.push(editFields.other.trim())
          }
          try {
            const resp = await fetchWithAuth(
              `${API_URL}/api/deals/${id}/request-edits`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  reason: editReason || '',
                  fields,
                  comment: editReason || ''
                })
              }
            )
            const data = await resp.json().catch(() => null)
            if (!resp.ok) {
              notifyError(
                data?.error?.message || 'Failed to request edits'
              )
            } else {
              notifySuccess('Edit request sent to consultant.')
              setShowEditModal(false)
              setEditFields({
                address: false,
                payment_plan: false,
                maintenance_date: false,
                offer_dates: false,
                other: ''
              })
              setEditReason('')
              await load()
            }
          } catch (err) {
            notifyError(err, 'Failed to request edits')
          }
        }}
      />

    </div>
  )
}