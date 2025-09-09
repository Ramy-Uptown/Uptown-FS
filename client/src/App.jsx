import React, { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function App() {
  const [message, setMessage] = useState('Loading...')
  const [health, setHealth] = useState(null)
  const [calcResult, setCalcResult] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState('')

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