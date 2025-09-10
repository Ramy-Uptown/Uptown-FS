import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [deal, setDeal] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [details, setDetails] = useState('{}')
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const role = user?.role || 'user'

  async function load() {
    try {
      setError('')
      // Load all deals and pick one quickly (no GET /api/deals/:id endpoint)
      const dealsResp = await fetchWithAuth(`${API_URL}/api/deals`)
      const dealsData = await dealsResp.json()
      if (!dealsResp.ok) throw new Error(dealsData?.error?.message || 'Failed to load deal')
      const d = (dealsData.deals || []).find(x => String(x.id) === String(id))
      setDeal(d || null)
      if (d) {
        setTitle(d.title || '')
        setAmount(String(d.amount ?? ''))
        setDetails(JSON.stringify(d.details || {}, null, 2))
      }

      const histResp = await fetchWithAuth(`${API_URL}/api/deals/${id}/history`)
      const histData = await histResp.json()
      if (!histResp.ok) throw new Error(histData?.error?.message || 'Failed to load history')
      setHistory(histData.history || [])
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  useEffect(() => { load() }, [id])

  const isOwner = deal && user && deal.created_by === user.id
  const canEdit = deal && deal.status === 'draft' && (isOwner || role === 'admin')
  const canSubmit = deal && deal.status === 'draft' && (isOwner || role === 'admin')

  async function saveChanges() {
    try {
      let detailsObj = {}
      if (details && details.trim()) {
        try {
          detailsObj = JSON.parse(details)
        } catch {
          throw new Error('Details must be valid JSON')
        }
      }
      const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, amount: Number(amount) || 0, details: detailsObj })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to save')
      setEdit(false)
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  async function submitForApproval() {
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/submit`, { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Submit failed')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  if (error) return <p style={{ color: '#e11d48' }}>{error}</p>
  if (!deal) return <p>Loading…</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ marginTop: 0 }}>Deal #{deal.id}</h2>
        <button onClick={() => navigate('/deals')} style={btn}>Back to Dashboard</button>
      </div>

      {!edit ? (
        <div style={{ marginBottom: 16 }}>
          <p><strong>Title:</strong> {deal.title}</p>
          <p><strong>Amount:</strong> {Number(deal.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p><strong>Status:</strong> {deal.status}</p>
          <p><strong>Details:</strong></p>
          <pre style={pre}>{JSON.stringify(deal.details || {}, null, 2)}</pre>
          <p><strong>Created By:</strong> {deal.created_by_email || deal.created_by}</p>
          <p><strong>Created At:</strong> {deal.created_at ? new Date(deal.created_at).toLocaleString() : ''}</p>
        </div>
      ) : (
        <div style={{ marginBottom: 16, display: 'grid', gap: 12, maxWidth: 700 }}>
          <div>
            <label style={label}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Amount</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Details (JSON)</label>
            <textarea value={details} onChange={e => setDetails(e.target.value)} style={textarea} rows={10} />
          </div>
          <div>
            <button onClick={saveChanges} style={btnPrimary}>Save</button>
            <button onClick={() => setEdit(false)} style={btn}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {canEdit && !edit && <button onClick={() => setEdit(true)} style={btn}>Edit</button>}
        {canSubmit && <button onClick={submitForApproval} style={btnPrimary}>Submit for Approval</button>}
      </div>

      <h3>Audit Trail</h3>
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Action</th>
              <th style={th}>User</th>
              <th style={th}>Notes</th>
              <th style={th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, idx) => (
              <tr key={h.id}>
                <td style={td}>{idx + 1}</td>
                <td style={td}>{h.action}</td>
                <td style={td}>{h.user_email || h.user_id}</td>
                <td style={td}>{h.notes || ''}</td>
                <td style={td}>{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td style={td} colSpan={5}>No history yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const label = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }
const input = { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', width: '100%' }
const textarea = { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', width: '100%', fontFamily: 'monospace' }
const btn = { marginLeft: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }
const btnPrimary = { padding: '10px 14px', borderRadius: 10, border: '1px solid #1f6feb', background: '#1f6feb', color: '#fff', fontWeight: 600 }
const pre = { background: '#f6f8fa', padding: 12, borderRadius: 8, overflow: 'auto', border: '1px solid #eef2f7' }
const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }