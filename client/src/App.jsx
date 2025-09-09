import React, { useEffect, useMemo, useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const LS_KEY = 'uptown_calc_form_state_v1'

export default function App() {
  const [message, setMessage] = useState('Loading...')
  const [health, setHealth] = useState(null)
  const [calcResult, setCalcResult] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState('')

  // Inline validation state
  const [errors, setErrors] = useState({})

  // Custom form state
  const [mode, setMode] = useState('calculateForTargetPV')
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

  // Load persisted state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved) {
          if (saved.mode) setMode(saved.mode)
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
    const snapshot = { mode, stdPlan, inputs, firstYearPayments, subsequentYears }
    localStorage.setItem(LS_KEY, JSON.stringify(snapshot))
  }, [mode, stdPlan, inputs, firstYearPayments, subsequentYears])

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

  async function runSampleCalculation() {
    setCalcLoading(true)
    setCalcError('')
    setCalcResult(null)
    try {
      const body = {
        mode: 'calculateForTargetPV',
        stdPlan: {
          totalPrice: 1000000,
          financialDiscountRate: 12,
          calculatedPV: 850000
        },
        inputs: {
          dpType: 'amount',
          downPaymentValue: 100000,
          planDurationYears: 5,
          installmentFrequency: 'monthly',
          additionalHandoverPayment: 0,
          handoverYear: 2,
          splitFirstYearPayments: false,
          firstYearPayments: [],
          subsequentYears: []
        }
      }
      const resp = await fetch(`${API_URL}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Request failed')
      }
      setCalcResult(data)
    } catch (e) {
      setCalcError(e.message || String(e))
    } finally {
      setCalcLoading(false)
    }
  }

  async function runCustomCalculation(e) {
    e.preventDefault()
    const { valid, payload } = validateForm()
    if (!valid) {
      setCalcError('Please fix validation errors before submitting.')
      return
    }
    setCalcLoading(true)
    setCalcError('')
    setCalcResult(null)
    try {
      const resp = await fetch(`${API_URL}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Request failed')
      }
      setCalcResult(data)
    } catch (e) {
      setCalcError(e.message || String(e))
    } finally {
      setCalcLoading(false)
    }
  }

  function inputStyle(hasError) {
    return { padding: 8, borderRadius: 6, border: `1px solid ${hasError ? '#c00' : '#ccc'}`, width: '100%' }
  }

  // Dynamic handlers
  function addFirstYearPayment() {
    setFirstYearPayments(arr => [...arr, { amount: '', month: '', type: 'regular' }])
  }
  function removeFirstYearPayment(idx) {
    setFirstYearPayments(arr => arr.filter((_, i) => i !== idx))
  }
  function updateFirstYearPayment(idx, key, value) {
    setFirstYearPayments(arr => arr.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }

  function addSubsequentYear() {
    setSubsequentYears(arr => [...arr, { totalNominal: '', frequency: 'annually' }])
  }
  function removeSubsequentYear(idx) {
    setSubsequentYears(arr => arr.filter((_, i) => i !== idx))
  }
  function updateSubsequentYear(idx, key, value) {
    setSubsequentYears(arr => arr.map((y, i) => i === idx ? { ...y, [key]: value } : y))
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

  return (
    <div style={{ fontFamily: 'system-ui, Arial, sans-serif', lineHeight: 1.4, padding: 24 }}>
      <h1>Vite + React + Express</h1>
      <p style={{ color: '#666' }}>
        Client is running in Docker on port 5173. Server on port 3000.
      </p>

      <section style={{ marginTop: 16 }}>
        <h2>API Connectivity</h2>
        <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 8, overflow: 'auto' }}>
{JSON.stringify(health, null, 2)}
        </pre>
        <p><strong>Message from API:</strong> {message}</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Calculation API Demo</h2>
        <button
          onClick={runSampleCalculation}
          disabled={calcLoading}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
        >
          {calcLoading ? 'Running...' : 'Run Sample Calculation'}
        </button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Try Your Own Payload</h2>
        <form onSubmit={runCustomCalculation} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 1000 }}>
          <div>
            <label>Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)} style={inputStyle()}>
              <option value="evaluateCustomPrice">evaluateCustomPrice</option>
              <option value="calculateForTargetPV">calculateForTargetPV</option>
              <option value="customYearlyThenEqual_useStdPrice">customYearlyThenEqual_useStdPrice</option>
              <option value="customYearlyThenEqual_targetPV">customYearlyThenEqual_targetPV</option>
            </select>
          </div>

          <div>
            <label>Installment Frequency</label>
            <select value={inputs.installmentFrequency} onChange={e => setInputs(s => ({ ...s, installmentFrequency: e.target.value }))} style={inputStyle(errors.installmentFrequency)}>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="bi-annually">bi-annually</option>
              <option value="annually">annually</option>
            </select>
            {errors.installmentFrequency && <small style={{ color: '#c00' }}>{errors.installmentFrequency}</small>}
          </div>

          <div>
            <label>Std Total Price</label>
            <input type="number" value={stdPlan.totalPrice} onChange={e => setStdPlan(s => ({ ...s, totalPrice: e.target.value }))} style={inputStyle(errors.std_totalPrice)} />
            {errors.std_totalPrice && <small style={{ color: '#c00' }}>{errors.std_totalPrice}</small>}
          </div>
          <div>
            <label>Std Financial Rate (%)</label>
            <input type="number" value={stdPlan.financialDiscountRate} onChange={e => setStdPlan(s => ({ ...s, financialDiscountRate: e.target.value }))} style={inputStyle(errors.std_financialDiscountRate)} />
            {errors.std_financialDiscountRate && <small style={{ color: '#c00' }}>{errors.std_financialDiscountRate}</small>}
          </div>
          <div>
            <label>Std Calculated PV</label>
            <input type="number" value={stdPlan.calculatedPV} onChange={e => setStdPlan(s => ({ ...s, calculatedPV: e.target.value }))} style={inputStyle(errors.std_calculatedPV)} />
            {errors.std_calculatedPV && <small style={{ color: '#c00' }}>{errors.std_calculatedPV}</small>}
          </div>

          <div>
            <label>Sales Discount (%)</label>
            <input type="number" value={inputs.salesDiscountPercent} onChange={e => setInputs(s => ({ ...s, salesDiscountPercent: e.target.value }))} style={inputStyle()} />
          </div>

          <div>
            <label>DP Type</label>
            <select value={inputs.dpType} onChange={e => setInputs(s => ({ ...s, dpType: e.target.value }))} style={inputStyle(errors.dpType)}>
              <option value="amount">amount</option>
              <option value="percentage">percentage</option>
            </select>
            {errors.dpType && <small style={{ color: '#c00' }}>{errors.dpType}</small>}
          </div>
          <div>
            <label>Down Payment Value</label>
            <input type="number" value={inputs.downPaymentValue} onChange={e => setInputs(s => ({ ...s, downPaymentValue: e.target.value }))} style={inputStyle(errors.downPaymentValue)} />
            {errors.downPaymentValue && <small style={{ color: '#c00' }}>{errors.downPaymentValue}</small>}
          </div>

          <div>
            <label>Plan Duration (years)</label>
            <input type="number" value={inputs.planDurationYears} onChange={e => setInputs(s => ({ ...s, planDurationYears: e.target.value }))} style={inputStyle(errors.planDurationYears)} />
            {errors.planDurationYears && <small style={{ color: '#c00' }}>{errors.planDurationYears}</small>}
          </div>

          <div>
            <label>Handover Year</label>
            <input type="number" value={inputs.handoverYear} onChange={e => setInputs(s => ({ ...s, handoverYear: e.target.value }))} style={inputStyle(errors.handoverYear)} />
            {errors.handoverYear && <small style={{ color: '#c00' }}>{errors.handoverYear}</small>}
          </div>
          <div>
            <label>Additional Handover Payment</label>
            <input type="number" value={inputs.additionalHandoverPayment} onChange={e => setInputs(s => ({ ...s, additionalHandoverPayment: e.target.value }))} style={inputStyle(errors.additionalHandoverPayment)} />
            {errors.additionalHandoverPayment && <small style={{ color: '#c00' }}>{errors.additionalHandoverPayment}</small>}
          </div>

          <div style={{ gridColumn: '1 / span 2' }}>
            <label>
              <input type="checkbox" checked={inputs.splitFirstYearPayments} onChange={e => setInputs(s => ({ ...s, splitFirstYearPayments: e.target.checked }))} />
              {' '}Split First Year Payments?
            </label>
          </div>

          {/* First Year Payments Builder */}
          {inputs.splitFirstYearPayments && (
            <div style={{ gridColumn: '1 / span 2', border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>First Year Payments</h3>
                <button type="button" onClick={addFirstYearPayment} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
                  + Add Payment
                </button>
              </div>
              {firstYearPayments.length === 0 ? (
                <p style={{ color: '#666', marginTop: 8 }}>No first-year payments defined.</p>
              ) : (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}>
                  {firstYearPayments.map((p, idx) => {
                    const errAmt = errors[`fyp_amount_${idx}`]
                    const errMonth = errors[`fyp_month_${idx}`]
                    return (
                      <React.Fragment key={idx}>
                        <div>
                          <label>Amount (EGP)</label>
                          <input type="number" value={p.amount} onChange={e => updateFirstYearPayment(idx, 'amount', e.target.value)} style={inputStyle(errAmt)} />
                          {errAmt && <small style={{ color: '#c00' }}>{errAmt}</small>}
                        </div>
                        <div>
                          <label>Month (1-12)</label>
                          <input type="number" min="1" max="12" value={p.month} onChange={e => updateFirstYearPayment(idx, 'month', e.target.value)} style={inputStyle(errMonth)} />
                          {errMonth && <small style={{ color: '#c00' }}>{errMonth}</small>}
                        </div>
                        <div>
                          <label>Type</label>
                          <select value={p.type} onChange={e => updateFirstYearPayment(idx, 'type', e.target.value)} style={inputStyle()}>
                            <option value="dp">dp</option>
                            <option value="regular">regular</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'end' }}>
                          <button type="button" onClick={() => removeFirstYearPayment(idx)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
                            Remove
                          </button>
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Subsequent Years Builder */}
          <div style={{ gridColumn: '1 / span 2', border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Subsequent Custom Years</h3>
              <button type="button" onClick={addSubsequentYear} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
                + Add Year
              </button>
            </div>
            {subsequentYears.length === 0 ? (
              <p style={{ color: '#666', marginTop: 8 }}>No subsequent custom years defined.</p>
            ) : (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                {subsequentYears.map((y, idx) => {
                  const errTot = errors[`sub_total_${idx}`]
                  const errFreq = errors[`sub_freq_${idx}`]
                  return (
                    <React.Fragment key={idx}>
                      <div>
                        <label>Total Nominal (EGP)</label>
                        <input type="number" value={y.totalNominal} onChange={e => updateSubsequentYear(idx, 'totalNominal', e.target.value)} style={inputStyle(errTot)} />
                        {errTot && <small style={{ color: '#c00' }}>{errTot}</small>}
                      </div>
                      <div>
                        <label>Frequency</label>
                        <select value={y.frequency} onChange={e => updateSubsequentYear(idx, 'frequency', e.target.value)} style={inputStyle(errFreq)}>
                          <option value="monthly">monthly</option>
                          <option value="quarterly">quarterly</option>
                          <option value="bi-annually">bi-annually</option>
                          <option value="annually">annually</option>
                        </select>
                        {errFreq && <small style={{ color: '#c00' }}>{errFreq}</small>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'end' }}>
                        <button type="button" onClick={() => removeSubsequentYear(idx)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={calcLoading}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
            >
              {calcLoading ? 'Running...' : 'Run Custom Calculation'}
            </button>
          </div>
        </form>

        {/* Live Computed Summaries */}
        <div style={{ marginTop: 16, border: '1px solid #eee', borderRadius: 8, padding: 12, maxWidth: 1000 }}>
          <h3 style={{ marginTop: 0 }}>Live Preview</h3>
          {previewError ? <p style={{ color: '#c00' }}>{previewError}</p> : null}
          {summaries ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>Total Nominal Price: {Number(summaries.totalNominalPrice || 0).toLocaleString()}</li>
              <li>Equal Installments: {summaries.numEqualInstallments}</li>
              <li>Installment Amount: {Number(summaries.equalInstallmentAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
              <li>Calculated PV: {Number(summaries.calculatedPV || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
              <li>Effective Start Years (for installments): {summaries.effectiveStartYears}</li>
            </ul>
          ) : (
            !previewError && <p style={{ color: '#666' }}>Adjust form inputs to see live preview.</p>
          )}
        </div>

        {calcError ? (
          <p style={{ color: '#c00', marginTop: 8 }}>{calcError}</p>
        ) : null}
        {calcResult ? (
          <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 8, overflow: 'auto', marginTop: 12 }}>
{JSON.stringify(calcResult, null, 2)}
          </pre>
        ) : null}
      </section>
    </div>
  )
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function App() {
  const [message, setMessage] = useState('Loading...')
  const [health, setHealth] = useState(null)
  const [calcResult, setCalcResult] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState('')

  // Custom form state
  const [mode, setMode] = useState('calculateForTargetPV')
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
  const [firstYearPayments, setFirstYearPayments] = useState([
    // { amount: 50000, month: 1, type: 'dp' },
    // { amount: 25000, month: 6, type: 'regular' }
  ])
  const [subsequentYears, setSubsequentYears] = useState([
    // { totalNominal: 120000, frequency: 'quarterly' }
  ])

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

  async function runSampleCalculation() {
    setCalcLoading(true)
    setCalcError('')
    setCalcResult(null)
    try {
      const body = {
        mode: 'calculateForTargetPV',
        stdPlan: {
          totalPrice: 1000000,
          financialDiscountRate: 12,
          calculatedPV: 850000
        },
        inputs: {
          dpType: 'amount',
          downPaymentValue: 100000,
          planDurationYears: 5,
          installmentFrequency: 'monthly',
          additionalHandoverPayment: 0,
          handoverYear: 2,
          splitFirstYearPayments: false,
          firstYearPayments: [],
          subsequentYears: []
        }
      }
      const resp = await fetch(`${API_URL}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Request failed')
      }
      setCalcResult(data)
    } catch (e) {
      setCalcError(e.message || String(e))
    } finally {
      setCalcLoading(false)
    }
  }

  async function runCustomCalculation(e) {
    e.preventDefault()
    setCalcLoading(true)
    setCalcError('')
    setCalcResult(null)
    try {
      const body = {
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
      const resp = await fetch(`${API_URL}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Request failed')
      }
      setCalcResult(data)
    } catch (e) {
      setCalcError(e.message || String(e))
    } finally {
      setCalcLoading(false)
    }
  }

  function inputStyle() {
    return { padding: 8, borderRadius: 6, border: '1px solid #ccc', width: '100%' }
  }

  // Dynamic handlers
  function addFirstYearPayment() {
    setFirstYearPayments(arr => [...arr, { amount: '', month: '', type: 'regular' }])
  }
  function removeFirstYearPayment(idx) {
    setFirstYearPayments(arr => arr.filter((_, i) => i !== idx))
  }
  function updateFirstYearPayment(idx, key, value) {
    setFirstYearPayments(arr => arr.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }

  function addSubsequentYear() {
    setSubsequentYears(arr => [...arr, { totalNominal: '', frequency: 'annually' }])
  }
  function removeSubsequentYear(idx) {
    setSubsequentYears(arr => arr.filter((_, i) => i !== idx))
  }
  function updateSubsequentYear(idx, key, value) {
    setSubsequentYears(arr => arr.map((y, i) => i === idx ? { ...y, [key]: value } : y))
  }

  return (
    <div style={{ fontFamily: 'system-ui, Arial, sans-serif', lineHeight: 1.4, padding: 24 }}>
      <h1>Vite + React + Express</h1>
      <p style={{ color: '#666' }}>
        Client is running in Docker on port 5173. Server on port 3000.
      </p>

      <section style={{ marginTop: 16 }}>
        <h2>API Connectivity</h2>
        <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 8, overflow: 'auto' }}>
{JSON.stringify(health, null, 2)}
        </pre>
        <p><strong>Message from API:</strong> {message}</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Calculation API Demo</h2>
        <button
          onClick={runSampleCalculation}
          disabled={calcLoading}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
        >
          {calcLoading ? 'Running...' : 'Run Sample Calculation'}
        </button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Try Your Own Payload</h2>
        <form onSubmit={runCustomCalculation} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 1000 }}>
          <div>
            <label>Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)} style={inputStyle()}>
              <option value="evaluateCustomPrice">evaluateCustomPrice</option>
              <option value="calculateForTargetPV">calculateForTargetPV</option>
              <option value="customYearlyThenEqual_useStdPrice">customYearlyThenEqual_useStdPrice</option>
              <option value="customYearlyThenEqual_targetPV">customYearlyThenEqual_targetPV</option>
            </select>
          </div>

          <div>
            <label>Installment Frequency</label>
            <select value={inputs.installmentFrequency} onChange={e => setInputs(s => ({ ...s, installmentFrequency: e.target.value }))} style={inputStyle()}>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="bi-annually">bi-annually</option>
              <option value="annually">annually</option>
            </select>
          </div>

          <div>
            <label>Std Total Price</label>
            <input type="number" value={stdPlan.totalPrice} onChange={e => setStdPlan(s => ({ ...s, totalPrice: e.target.value }))} style={inputStyle()} />
          </div>
          <div>
            <label>Std Financial Rate (%)</label>
            <input type="number" value={stdPlan.financialDiscountRate} onChange={e => setStdPlan(s => ({ ...s, financialDiscountRate: e.target.value }))} style={inputStyle()} />
          </div>
          <div>
            <label>Std Calculated PV</label>
            <input type="number" value={stdPlan.calculatedPV} onChange={e => setStdPlan(s => ({ ...s, calculatedPV: e.target.value }))} style={inputStyle()} />
          </div>

          <div>
            <label>Sales Discount (%)</label>
            <input type="number" value={inputs.salesDiscountPercent} onChange={e => setInputs(s => ({ ...s, salesDiscountPercent: e.target.value }))} style={inputStyle()} />
          </div>

          <div>
            <label>DP Type</label>
            <select value={inputs.dpType} onChange={e => setInputs(s => ({ ...s, dpType: e.target.value }))} style={inputStyle()}>
              <option value="amount">amount</option>
              <option value="percentage">percentage</option>
            </select>
          </div>
          <div>
            <label>Down Payment Value</label>
            <input type="number" value={inputs.downPaymentValue} onChange={e => setInputs(s => ({ ...s, downPaymentValue: e.target.value }))} style={inputStyle()} />
          </div>

          <div>
            <label>Plan Duration (years)</label>
            <input type="number" value={inputs.planDurationYears} onChange={e => setInputs(s => ({ ...s, planDurationYears: e.target.value }))} style={inputStyle()} />
          </div>

          <div>
            <label>Handover Year</label>
            <input type="number" value={inputs.handoverYear} onChange={e => setInputs(s => ({ ...s, handoverYear: e.target.value }))} style={inputStyle()} />
          </div>
          <div>
            <label>Additional Handover Payment</label>
            <input type="number" value={inputs.additionalHandoverPayment} onChange={e => setInputs(s => ({ ...s, additionalHandoverPayment: e.target.value }))} style={inputStyle()} />
          </div>

          <div style={{ gridColumn: '1 / span 2' }}>
            <label>
              <input type="checkbox" checked={inputs.splitFirstYearPayments} onChange={e => setInputs(s => ({ ...s, splitFirstYearPayments: e.target.checked }))} />
              {' '}Split First Year Payments?
            </label>
          </div>

          {/* First Year Payments Builder */}
          {inputs.splitFirstYearPayments && (
            <div style={{ gridColumn: '1 / span 2', border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>First Year Payments</h3>
                <button type="button" onClick={addFirstYearPayment} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
                  + Add Payment
                </button>
              </div>
              {firstYearPayments.length === 0 ? (
                <p style={{ color: '#666', marginTop: 8 }}>No first-year payments defined.</p>
              ) : (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}>
                  {firstYearPayments.map((p, idx) => (
                    <React.Fragment key={idx}>
                      <div>
                        <label>Amount (EGP)</label>
                        <input type="number" value={p.amount} onChange={e => updateFirstYearPayment(idx, 'amount', e.target.value)} style={inputStyle()} />
                      </div>
                      <div>
                        <label>Month (1-12)</label>
                        <input type="number" min="1" max="12" value={p.month} onChange={e => updateFirstYearPayment(idx, 'month', e.target.value)} style={inputStyle()} />
                      </div>
                      <div>
                        <label>Type</label>
                        <select value={p.type} onChange={e => updateFirstYearPayment(idx, 'type', e.target.value)} style={inputStyle()}>
                          <option value="dp">dp</option>
                          <option value="regular">regular</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'end' }}>
                        <button type="button" onClick={() => removeFirstYearPayment(idx)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subsequent Years Builder */}
          <div style={{ gridColumn: '1 / span 2', border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Subsequent Custom Years</h3>
              <button type="button" onClick={addSubsequentYear} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
                + Add Year
              </button>
            </div>
            {subsequentYears.length === 0 ? (
              <p style={{ color: '#666', marginTop: 8 }}>No subsequent custom years defined.</p>
            ) : (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                {subsequentYears.map((y, idx) => (
                  <React.Fragment key={idx}>
                    <div>
                      <label>Total Nominal (EGP)</label>
                      <input type="number" value={y.totalNominal} onChange={e => updateSubsequentYear(idx, 'totalNominal', e.target.value)} style={inputStyle()} />
                    </div>
                    <div>
                      <label>Frequency</label>
                      <select value={y.frequency} onChange={e => updateSubsequentYear(idx, 'frequency', e.target.value)} style={inputStyle()}>
                        <option value="monthly">monthly</option>
                        <option value="quarterly">quarterly</option>
                        <option value="bi-annually">bi-annually</option>
                        <option value="annually">annually</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      <button type="button" onClick={() => removeSubsequentYear(idx)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={calcLoading}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
            >
              {calcLoading ? 'Running...' : 'Run Custom Calculation'}
            </button>
          </div>
        </form>

        {calcError ? (
          <p style={{ color: '#c00', marginTop: 8 }}>{calcError}</p>
        ) : null}
        {calcResult ? (
          <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 8, overflow: 'auto', marginTop: 12 }}>
{JSON.stringify(calcResult, null, 2)}
          </pre>
        ) : null}
      </section>
    </div>
  )
}