import React, { useEffect, useState } from 'react'

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

  function inputStyle() {
    return { padding: 8, borderRadius: 6, border: '1px solid #ccc', width: '100%' }
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
        <form onSubmit={runCustomCalculation} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 900 }}>
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