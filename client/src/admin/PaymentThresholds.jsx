import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function PaymentThresholds() {
  const [thresholds, setThresholds] = useState({
    firstYearPercentMin: '',
    firstYearPercentMax: '',
    secondYearPercentMin: '',
    secondYearPercentMax: '',
    handoverPercentMin: '',
    handoverPercentMax: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds`)
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load thresholds')
        if (mounted) setThresholds({
          firstYearPercentMin: data.thresholds.firstYearPercentMin ?? '',
          firstYearPercentMax: data.thresholds.firstYearPercentMax ?? '',
          secondYearPercentMin: data.thresholds.secondYearPercentMin ?? '',
          secondYearPercentMax: data.thresholds.secondYearPercentMax ?? '',
          handoverPercentMin: data.thresholds.handoverPercentMin ?? '',
          handoverPercentMax: data.thresholds.handoverPercentMax ?? ''
        })
      } catch (e) {
        setError(e.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const onChange = (key) => (e) => {
    const val = e.target.value
    setThresholds(s => ({ ...s, [key]: val }))
  }

  async function save() {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      // Convert empty strings to null
      const body = Object.fromEntries(Object.entries(thresholds).map(([k, v]) => [k, v === '' ? null : Number(v)]))
      const resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to save thresholds')
      setSuccess('Thresholds updated')
      setThresholds({
        firstYearPercentMin: data.thresholds.firstYearPercentMin ?? '',
        firstYearPercentMax: data.thresholds.firstYearPercentMax ?? '',
        secondYearPercentMin: data.thresholds.secondYearPercentMin ?? '',
        secondYearPercentMax: data.thresholds.secondYearPercentMax ?? '',
        handoverPercentMin: data.thresholds.handoverPercentMin ?? '',
        handoverPercentMax: data.thresholds.handoverPercentMax ?? ''
      })
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Payment Thresholds</h2>
      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      {success ? <p style={{ color: '#10b981' }}>{success}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 640 }}>
        <div>
          <label>First Year Min (%)</label>
          <input type="number" step="0.01" value={thresholds.firstYearPercentMin} onChange={onChange('firstYearPercentMin')} style={inputStyle} />
        </div>
        <div>
          <label>First Year Max (%)</label>
          <input type="number" step="0.01" value={thresholds.firstYearPercentMax} onChange={onChange('firstYearPercentMax')} style={inputStyle} />
        </div>
        <div>
          <label>Second Year Min (%)</label>
          <input type="number" step="0.01" value={thresholds.secondYearPercentMin} onChange={onChange('secondYearPercentMin')} style={inputStyle} />
        </div>
        <div>
          <label>Second Year Max (%)</label>
          <input type="number" step="0.01" value={thresholds.secondYearPercentMax} onChange={onChange('secondYearPercentMax')} style={inputStyle} />
        </div>
        <div>
          <label>Handover Min (%)</label>
          <input type="number" step="0.01" value={thresholds.handoverPercentMin} onChange={onChange('handoverPercentMin')} style={inputStyle} />
        </div>
        <div>
          <label>Handover Max (%)</label>
          <input type="number" step="0.01" value={thresholds.handoverPercentMax} onChange={onChange('handoverPercentMax')} style={inputStyle} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={save} disabled={saving} style={btnPrimaryStyle}>
          {saving ? 'Saving...' : 'Save Thresholds'}
        </button>
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d1d9e6',
  outline: 'none',
  width: '100%',
  fontSize: 14,
  background: '#fff'
}

const btnPrimaryStyle = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #1f6feb',
  background: '#1f6feb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600
}