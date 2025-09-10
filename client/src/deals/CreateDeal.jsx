import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function CreateDeal() {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [details, setDetails] = useState('{}')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let detailsObj = {}
      if (details && details.trim()) {
        try {
          detailsObj = JSON.parse(details)
        } catch {
          throw new Error('Details must be valid JSON')
        }
      }
      const resp = await fetchWithAuth(`${API_URL}/api/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, amount: Number(amount) || 0, details: detailsObj })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to create deal')
      navigate(`/deals/${data.deal.id}`)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Create Deal</h2>
      <form onSubmit={onSubmit} style={{ maxWidth: 600, display: 'grid', gap: 12 }}>
        <div>
          <label style={label}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={input} required />
        </div>
        <div>
          <label style={label}>Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={input} />
        </div>
        <div>
          <label style={label}>Details (JSON)</label>
          <textarea value={details} onChange={e => setDetails(e.target.value)} style={textarea} rows={8} />
        </div>
        {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
        <div>
          <button type="submit" disabled={loading} style={btnPrimary}>
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

const label = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }
const input = { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', width: '100%' }
const textarea = { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', width: '100%', fontFamily: 'monospace' }
const btnPrimary = { padding: '10px 14px', borderRadius: 10, border: '1px solid #1f6feb', background: '#1f6feb', color: '#fff', fontWeight: 600 }