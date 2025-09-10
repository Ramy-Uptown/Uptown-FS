import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const LS_KEY = 'uptown_calc_form_state_v2'

const styles = {
  page: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    background: '#f7f9fb',
    minHeight: '100vh',
    color: '#222'
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '24px 20px 48px'
  },
  header: {
    background: '#fff',
    border: '1px solid #e6eaf0',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    boxShadow: '0 2px 6px rgba(21, 24, 28, 0.04)'
  },
  h1: { margin: 0, fontSize: 22, fontWeight: 700 },
  sub: { color: '#6b7280', marginTop: 6, fontSize: 13 },
  section: {
    background: '#fff',
    border: '1px solid #e6eaf0',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    boxShadow: '0 2px 6px rgba(21, 24, 28, 0.04)'
  },
  sectionTitle: { margin: '0 0 12px 0', fontSize: 18, fontWeight: 600 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  blockFull: { gridColumn: '1 / span 2' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: (err) => ({
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${err ? '#e11d48' : '#dfe5ee'}`,
    outline: 'none',
    width: '100%',
    fontSize: 14,
    background: '#fbfdff'
  }),
  select: (err) => ({
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${err ? '#e11d48' : '#dfe5ee'}`,
    outline: 'none',
    width: '100%',
    fontSize: 14,
    background: '#fbfdff'
  }),
  metaText: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #d1d9e6',
    background: '#fff',
    color: '#111827',
    cursor: 'pointer'
  },
  btnPrimary: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #1f6feb',
    background: '#1f6feb',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600
  },
  tableWrap: {
    maxWidth: 1200,
    overflow: 'auto',
    border: '1px solid #e6eaf0',
    borderRadius: 12
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: 12, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' },
  td: { padding: 12, borderBottom: '1px solid #f2f5fa', fontSize: 14 },
  tFootCell: { padding: 12, fontWeight: 700, background: '#fbfdff' },
  error: { color: '#e11d48' }
}

export default function App() {
  const [message, setMessage] = useState('Loading...')
  const [health, setHealth] = useState(null)

  // Inline validation state
  const [errors, setErrors] = useState({})

  // Custom form state
  const [mode, setMode] = useState('calculateForTargetPV')
  const [language, setLanguage] = useState('en')
  const [currency, setCurrency] = useState('EGP')
  const [stdPlan, setStdPlan] = useState({
    totalPrice: 1000000,
    financialDiscountRate: 12,
    calculatedPV: 850000
  })
  const [inputs, setInputs] = useState({
    salesDiscountPercent: 1.5,
    dpType: 'amount',
    downPaymentValue: 100000,
    planDurationYears: 5,
    installmentFrequency: 'monthly',
    additionalHandoverPayment: 0,
    handoverYear: 2,
    splitFirstYearPayments: false
  })

  // Dynamic arrays
  const [firstYearPayments, setFirstYearPayments] = useState([])
  const [subsequentYears, setSubsequentYears] = useState([])

  // Live preview result
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const debounceTimer = useRef(null)

  // Generate-plan result
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState('')
  const [genResult, setGenResult] = useState(null)

  // Document generation state
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState('')

  // Load persisted state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved) {
          if (saved.mode) setMode(saved.mode)
          if (saved.language) setLanguage(saved.language)
          if (saved.currency) setCurrency(saved.currency)
          if (saved.stdPlan) setStdPlan(saved.stdPlan)
          if (saved.inputs) setInputs(saved.inputs)
          if (Array.isArray(saved.firstYearPayments)) setFirstYearPayments(saved.firstYearPayments)
          if (Array.isArray(saved.subsequentYears)) setSubsequentYears(saved.subsequentYears)
        }
      }
    } catch {}
  }, [])

  // Persist on change
  useEffect(() => {
    const snapshot = { mode, language, currency, stdPlan, inputs, firstYearPayments, subsequentYears }
    localStorage.setItem(LS_KEY, JSON.stringify(snapshot))
  }, [mode, language, currency, stdPlan, inputs, firstYearPayments, subsequentYears])

  // Initial health check
  useEffect(() => {
    async function load() {
      try {
        const [healthRes, msgRes] = await Promise.all([
          fetch(`${API_URL}/api/health`).then(r => r.json()),
          fetch(`${API_URL}/api/message`).then(r => r.json())
        ])
        setHealth(healthRes)
        setMessage(msgRes.message)
      } catch (err) {
        setMessage('Failed to reach API. Is Docker running?')
      }
    }
    load()
  }, [])

  function buildPayload() {
    return {
      mode,
      stdPlan: {
        totalPrice: Number(stdPlan.totalPrice),
        financialDiscountRate: Number(stdPlan.financialDiscountRate),
        calculatedPV: Number(stdPlan.calculatedPV)
      },
      inputs: {
        salesDiscountPercent: Number(inputs.salesDiscountPercent),
        dpType: inputs.dpType,
        downPaymentValue: Number(inputs.downPaymentValue),
        planDurationYears: Number(inputs.planDurationYears),
        installmentFrequency: inputs.installmentFrequency,
        additionalHandoverPayment: Number(inputs.additionalHandoverPayment),
        handoverYear: Number(inputs.handoverYear),
        splitFirstYearPayments: !!inputs.splitFirstYearPayments,
        firstYearPayments: firstYearPayments.map(p => ({
          amount: Number(p.amount) || 0,
          month: Number(p.month) || 0,
          type: p.type || 'regular'
        })),
        subsequentYears: subsequentYears.map(y => ({
          totalNominal: Number(y.totalNominal) || 0,
          frequency: y.frequency || 'annually'
        }))
      }
    }
  }

  // Client-side inline validation (mirrors server-side constraints)
  function validateForm() {
    const e = {}
    const payload = buildPayload()
    const { stdPlan: sp, inputs: inp } = payload

    if (!isFinite(sp.totalPrice) || sp.totalPrice < 0) e.std_totalPrice = 'Must be non-negative number'
    if (!isFinite(sp.financialDiscountRate)) e.std_financialDiscountRate = 'Must be a number'
    if (!isFinite(sp.calculatedPV) || sp.calculatedPV < 0) e.std_calculatedPV = 'Must be non-negative number'

    if (!['monthly', 'quarterly', 'bi-annually', 'annually'].includes(inp.installmentFrequency)) {
      e.installmentFrequency = 'Invalid'
    }
    if (!Number.isInteger(inp.planDurationYears) || inp.planDurationYears <= 0) {
      e.planDurationYears = 'Must be integer >= 1'
    }
    if (inp.dpType && !['amount', 'percentage'].includes(inp.dpType)) e.dpType = 'Invalid'
    if (!isFinite(inp.downPaymentValue) || inp.downPaymentValue < 0) e.downPaymentValue = 'Must be non-negative number'
    if (!Number.isInteger(inp.handoverYear) || inp.handoverYear <= 0) e.handoverYear = 'Must be integer >= 1'
    if (!isFinite(inp.additionalHandoverPayment) || inp.additionalHandoverPayment < 0) e.additionalHandoverPayment = 'Must be non-negative number'

    if (inp.splitFirstYearPayments) {
      firstYearPayments.forEach((p, idx) => {
        const keyAmt = `fyp_amount_${idx}`
        const keyMonth = `fyp_month_${idx}`
        if (!isFinite(Number(p.amount)) || Number(p.amount) < 0) e[keyAmt] = '>= 0'
        const m = Number(p.month)
        if (!Number.isInteger(m) || m < 1 || m > 12) e[keyMonth] = '1..12'
      })
    }

    subsequentYears.forEach((y, idx) => {
      const keyTot = `sub_total_${idx}`
      const keyFreq = `sub_freq_${idx}`
      if (!isFinite(Number(y.totalNominal)) || Number(y.totalNominal) < 0) e[keyTot] = '>= 0'
      if (!['monthly', 'quarterly', 'bi-annually', 'annually'].includes(y.frequency)) e[keyFreq] = 'Invalid'
    })

    setErrors(e)
    return { valid: Object.keys(e).length === 0, payload }
  }

  // Debounced live preview using the API
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      const { valid, payload } = validateForm()
      if (!valid) {
        setPreview(null)
        setPreviewError('Fix validation errors to see preview.')
        return
      }
      try {
        setPreviewError('')
        const resp = await fetch(`${API_URL}/api/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await resp.json()
        if (!resp.ok) {
          setPreview(null)
          setPreviewError(data?.error?.message || 'Preview error')
        } else {
          setPreview(data?.data || null)
        }
      } catch (err) {
        setPreview(null)
        setPreviewError('Could not compute preview.')
      }
    }, 500)
    return () => clearTimeout(debounceTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stdPlan, inputs, firstYearPayments, subsequentYears])

  async function runGeneratePlan(e) {
    e.preventDefault()
    const { valid, payload } = validateForm()
    if (!valid) {
      setGenError('Please fix validation errors before generating the plan.')
      return
    }
    setGenLoading(true)
    setGenError('')
    setGenResult(null)
    try {
      const body = { ...payload, language, currency }
      const resp = await fetch(`${API_URL}/api/generate-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Request failed')
      }
      setGenResult(data)
    } catch (e) {
      setGenError(e.message || String(e))
    } finally {
      setGenLoading(false)
    }
  }

  function exportScheduleCSV() {
    if (!genResult?.schedule?.length) return
    const rows = [
      ['#', 'Month', 'Label', 'Amount', 'Written Amount'],
      ...genResult.schedule.map((row, i) => ([
        i + 1,
        row.month,
        row.label,
        Number(row.amount || 0).toFixed(2),
        row.writtenAmount
      ]))
    ]
    const csv = rows.map(r => r.map(cell => {
      const s = String(cell ?? '')
      if (/[\",\n]/.test(s)) return `\"${s.replace(/\"/g, '\"\"')}\"`
      return s
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    a.download = `payment_schedule_${ts}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Build document generation body (includes calculator inputs + plan if available)
  function buildDocumentBody(documentType) {
    const { valid, payload } = validateForm()
    // Even if not valid, we still send what we have; but generally require valid to ensure server accepts
    const body = {
      documentType,
      language,
      currency,
      ...payload,
    }
    // Attach generated plan if available so server can reuse without recalculation (optional)
    if (genResult?.schedule?.length) {
      body.generatedPlan = {
        schedule: genResult.schedule,
        totals: genResult.totals,
        meta: genResult.meta || {}
      }
    }
    return { valid, body }
  }

  async function generateDocument(documentType) {
    const { valid, body } = buildDocumentBody(documentType)
    if (!valid) {
      setDocError('Please fix validation errors before generating the document.')
      return
    }
    setDocLoading(true)
    setDocError('')
    try {
      const resp = await fetch(`${API_URL}/api/generate-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!resp.ok) {
        // Try to parse JSON error
        let errMsg = 'Failed to generate document'
        try {
          const j = await resp.json()
          errMsg = j?.error?.message || errMsg
        } catch {}
        throw new Error(errMsg)
      }
      // Expect a file (pdf/docx). Get filename from Content-Disposition if available.
      const blob = await resp.blob()
      const cd = resp.headers.get('Content-Disposition') || ''
      const match = /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(cd)
      let filename = ''
      if (match) {
        filename = decodeURIComponent(match[1] || match[2] || '')
      }
      if (!filename) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        filename = `${documentType}_${ts}.pdf`
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setDocError(e.message || String(e))
    } finally {
      setDocLoading(false)
    }
  }

  function exportScheduleXLSX() {
    if (!genResult?.schedule?.length) return
    const aoa = [
      ['#', 'Month', 'Label', 'Amount', 'Written Amount'],
      ...genResult.schedule.map((row, i) => ([
        i + 1,
        row.month,
        row.label,
        Number(row.amount || 0).toFixed(2),
        row.writtenAmount
      ]))
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // Column widths for readability
    ws['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 28 }, { wch: 16 }, { wch: 50 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    a.download = `payment_schedule_${ts}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Computed summaries (from preview)
  const summaries = useMemo(() => {
    if (!preview) return null
    const {
      totalNominalPrice,
      numEqualInstallments,
      equalInstallmentAmount,
      calculatedPV,
      meta
    } = preview
    return {
      totalNominalPrice,
      numEqualInstallments,
      equalInstallmentAmount,
      calculatedPV,
      effectiveStartYears: meta?.effectiveStartYears
    }
  }, [preview])

  const schedule = genResult?.schedule || []
  const totals = genResult?.totals || null

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.h1}>Uptown Evaluator — Payment Plan</h1>
          <p style={styles.sub}>Create, preview, and export professional payment schedules.</p>
        </header>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>API Connectivity</h2>
          <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 8, overflow: 'auto', border: '1px solid #eef2f7' }}>
{JSON.stringify(health, null, 2)}
          </pre>
          <p style={{ ...styles.metaText }}><strong>Message from API:</strong> {message}</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Inputs</h2>
          <form onSubmit={runGeneratePlan} style={{ ...styles.grid2 }}>
            <div>
              <label style={styles.label}>Language for Written Amounts</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} style={styles.select()}>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>Currency (English only)</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={styles.select()}>
                <option value="EGP">EGP (Egyptian Pounds)</option>
                <option value="USD">USD (US Dollars)</option>
                <option value="SAR">SAR (Saudi Riyals)</option>
                <option value="EUR">EUR (Euros)</option>
                <option value="AED">AED (UAE Dirhams)</option>
                <option value="KWD">KWD (Kuwaiti Dinars)</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>Mode</label>
              <select value={mode} onChange={e => setMode(e.target.value)} style={styles.select()}>
                <option value="evaluateCustomPrice">evaluateCustomPrice</option>
                <option value="calculateForTargetPV">calculateForTargetPV</option>
                <option value="customYearlyThenEqual_useStdPrice">customYearlyThenEqual_useStdPrice</option>
                <option value="customYearlyThenEqual_targetPV">customYearlyThenEqual_targetPV</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>Installment Frequency</label>
              <select value={inputs.installmentFrequency} onChange={e => setInputs(s => ({ ...s, installmentFrequency: e.target.value }))} style={styles.select(errors.installmentFrequency)}>
                <option value="monthly">monthly</option>
                <option value="quarterly">quarterly</option>
                <option value="bi-annually">bi-annually</option>
                <option value="annually">annually</option>
              </select>
              {errors.installmentFrequency && <small style={styles.error}>{errors.installmentFrequency}</small>}
            </div>

            <div>
              <label style={styles.label}>Std Total Price</label>
              <input type="number" value={stdPlan.totalPrice} onChange={e => setStdPlan(s => ({ ...s, totalPrice: e.target.value }))} style={styles.input(errors.std_totalPrice)} />
              {errors.std_totalPrice && <small style={styles.error}>{errors.std_totalPrice}</small>}
            </div>
            <div>
              <label style={styles.label}>Std Financial Rate (%)</label>
              <input type="number" value={stdPlan.financialDiscountRate} onChange={e => setStdPlan(s => ({ ...s, financialDiscountRate: e.target.value }))} style={styles.input(errors.std_financialDiscountRate)} />
              {errors.std_financialDiscountRate && <small style={styles.error}>{errors.std_financialDiscountRate}</small>}
            </div>
            <div>
              <label style={styles.label}>Std Calculated PV</label>
              <input type="number" value={stdPlan.calculatedPV} onChange={e => setStdPlan(s => ({ ...s, calculatedPV: e.target.value }))} style={styles.input(errors.std_calculatedPV)} />
              {errors.std_calculatedPV && <small style={styles.error}>{errors.std_calculatedPV}</small>}
            </div>

            <div>
              <label style={styles.label}>Sales Discount (%)</label>
              <input type="number" value={inputs.salesDiscountPercent} onChange={e => setInputs(s => ({ ...s, salesDiscountPercent: e.target.value }))} style={styles.input()} />
            </div>

            <div>
              <label style={styles.label}>DP Type</label>
              <select value={inputs.dpType} onChange={e => setInputs(s => ({ ...s, dpType: e.target.value }))} style={styles.select(errors.dpType)}>
                <option value="amount">amount</option>
                <option value="percentage">percentage</option>
              </select>
              {errors.dpType && <small style={styles.error}>{errors.dpType}</small>}
            </div>
            <div>
              <label style={styles.label}>Down Payment Value</label>
              <input type="number" value={inputs.downPaymentValue} onChange={e => setInputs(s => ({ ...s, downPaymentValue: e.target.value }))} style={styles.input(errors.downPaymentValue)} />
              {errors.downPaymentValue && <small style={styles.error}>{errors.downPaymentValue}</small>}
            </div>

            <div>
              <label style={styles.label}>Plan Duration (years)</label>
              <input type="number" value={inputs.planDurationYears} onChange={e => setInputs(s => ({ ...s, planDurationYears: e.target.value }))} style={styles.input(errors.planDurationYears)} />
              {errors.planDurationYears && <small style={styles.error}>{errors.planDurationYears}</small>}
            </div>

            <div>
              <label style={styles.label}>Handover Year</label>
              <input type="number" value={inputs.handoverYear} onChange={e => setInputs(s => ({ ...s, handoverYear: e.target.value }))} style={styles.input(errors.handoverYear)} />
              {errors.handoverYear && <small style={styles.error}>{errors.handoverYear}</small>}
            </div>
            <div>
              <label style={styles.label}>Additional Handover Payment</label>
              <input type="number" value={inputs.additionalHandoverPayment} onChange={e => setInputs(s => ({ ...s, additionalHandoverPayment: e.target.value }))} style={styles.input(errors.additionalHandoverPayment)} />
              {errors.additionalHandoverPayment && <small style={styles.error}>{errors.additionalHandoverPayment}</small>}
            </div>

            <div style={styles.blockFull}>
              <label style={{ ...styles.label, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={inputs.splitFirstYearPayments} onChange={e => setInputs(s => ({ ...s, splitFirstYearPayments: e.target.checked }))} />
                Split First Year Payments?
              </label>
            </div>

            {/* First Year Payments Builder */}
            {inputs.splitFirstYearPayments && (
              <div style={{ ...styles.blockFull, border: '1px solid #eef2f7', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>First Year Payments</h3>
                  <button type="button" onClick={addFirstYearPayment} style={styles.btn}>+ Add Payment</button>
                </div>
                {firstYearPayments.length === 0 ? (
                  <p style={styles.metaText}>No first-year payments defined.</p>
                ) : (
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}>
                    {firstYearPayments.map((p, idx) => {
                      const errAmt = errors[`fyp_amount_${idx}`]
                      const errMonth = errors[`fyp_month_${idx}`]
                      return (
                        <React.Fragment key={idx}>
                          <div>
                            <label style={styles.label}>Amount</label>
                            <input type="number" value={p.amount} onChange={e => updateFirstYearPayment(idx, 'amount', e.target.value)} style={styles.input(errAmt)} />
                            {errAmt && <small style={styles.error}>{errAmt}</small>}
                          </div>
                          <div>
                            <label style={styles.label}>Month (1-12)</label>
                            <input type="number" min="1" max="12" value={p.month} onChange={e => updateFirstYearPayment(idx, 'month', e.target.value)} style={styles.input(errMonth)} />
                            {errMonth && <small style={styles.error}>{errMonth}</small>}
                          </div>
                          <div>
                            <label style={styles.label}>Type</label>
                            <select value={p.type} onChange={e => updateFirstYearPayment(idx, 'type', e.target.value)} style={styles.select()}>
                              <option value="dp">dp</option>
                              <option value="regular">regular</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'end' }}>
                            <button type="button" onClick={() => removeFirstYearPayment(idx)} style={styles.btn}>Remove</button>
                          </div>
                        </React.Fragment>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Subsequent Years Builder */}
            <div style={{ ...styles.blockFull, border: '1px solid #eef2f7', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Subsequent Custom Years</h3>
                <button type="button" onClick={addSubsequentYear} style={styles.btn}>+ Add Year</button>
              </div>
              {subsequentYears.length === 0 ? (
                <p style={styles.metaText}>No subsequent custom years defined.</p>
              ) : (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                  {subsequentYears.map((y, idx) => {
                    const errTot = errors[`sub_total_${idx}`]
                    const errFreq = errors[`sub_freq_${idx}`]
                    return (
                      <React.Fragment key={idx}>
                        <div>
                          <label style={styles.label}>Total Nominal</label>
                          <input type="number" value={y.totalNominal} onChange={e => updateSubsequentYear(idx, 'totalNominal', e.target.value)} style={styles.input(errTot)} />
                          {errTot && <small style={styles.error}>{errTot}</small>}
                        </div>
                        <div>
                          <label style={styles.label}>Frequency</label>
                          <select value={y.frequency} onChange={e => updateSubsequentYear(idx, 'frequency', e.target.value)} style={styles.select(errFreq)}>
                            <option value="monthly">monthly</option>
                            <option value="quarterly">quarterly</option>
                            <option value="bi-annually">bi-annually</option>
                            <option value="annually">annually</option>
                          </select>
                          {errFreq && <small style={styles.error}>{errFreq}</small>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'end' }}>
                          <button type="button" onClick={() => removeSubsequentYear(idx)} style={styles.btn}>Remove</button>
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Live Preview */}
            <div style={{ ...styles.blockFull, border: '1px solid #eef2f7', borderRadius: 10, padding: 12 }}>
              <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600 }}>Live Preview (Calculation)</h3>
              {previewError ? <p style={styles.error}>{previewError}</p> : null}
              {summaries ? (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>Total Nominal Price: {Number(summaries.totalNominalPrice || 0).toLocaleString()}</li>
                  <li>Equal Installments: {summaries.numEqualInstallments}</li>
                  <li>Installment Amount: {Number(summaries.equalInstallmentAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                  <li>Calculated PV: {Number(summaries.calculatedPV || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                  <li>Effective Start Years (for installments): {summaries.effectiveStartYears}</li>
                </ul>
              ) : (
                !previewError && <p style={styles.metaText}>Adjust form inputs to see live preview.</p>
              )}
            </div>

            <div style={{ ...styles.blockFull, display: 'flex', gap: 10 }}>
              <button type="submit" disabled={genLoading} style={{ ...styles.btnPrimary, opacity: genLoading ? 0.7 : 1 }}>
                {genLoading ? 'Calculating...' : 'Calculate (Generate Plan)'}
              </button>
            </div>
          </form>
        </section>

        {/* Results Table */}
        <section style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={styles.sectionTitle}>Payment Schedule</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => generateDocument('pricing_form')}
                disabled={docLoading}
                style={{ ...styles.btnPrimary, opacity: docLoading ? 0.7 : 1 }}
              >
                {docLoading ? 'Generating…' : 'Generate Pricing Form'}
              </button>
              <button
                type="button"
                onClick={() => generateDocument('contract')}
                disabled={docLoading}
                style={{ ...styles.btnPrimary, opacity: docLoading ? 0.7 : 1 }}
              >
                {docLoading ? 'Generating…' : 'Generate Contract'}
              </button>
              <button type="button" onClick={exportScheduleXLSX} disabled={!schedule.length} style={styles.btn}>
                Export to Excel (.xlsx)
              </button>
              <button type="button" onClick={exportScheduleCSV} disabled={!schedule.length} style={styles.btn}>
                Export to CSV
              </button>
            </div>
          </div>
          {genError ? <p style={styles.error}>{genError}</p> : null}
          {docError ? <p style={styles.error}>{docError}</p> : null}
          {schedule.length === 0 ? (
            <p style={styles.metaText}>No schedule yet. Fill the form and click "Calculate (Generate Plan)".</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Month</th>
                    <th style={styles.th}>Label</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...styles.th, textAlign: language === 'ar' ? 'right' : 'left' }}>Written Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>{idx + 1}</td>
                      <td style={styles.td}>{row.month}</td>
                      <td style={styles.td}>{row.label}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {Number(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...styles.td, direction: language === 'ar' ? 'rtl' : 'ltr', textAlign: language === 'ar' ? 'right' : 'left' }}>
                        {row.writtenAmount}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr>
                      <td colSpan="3" style={{ ...styles.tFootCell, textAlign: 'right' }}>Total</td>
                      <td style={{ ...styles.tFootCell, textAlign: 'right' }}>
                        {Number(totals.totalNominal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={styles.tFootCell}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}