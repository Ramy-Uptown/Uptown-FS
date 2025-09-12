import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function HoldsFM() {
  const [status, setStatus] = useState('approved')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      setLoading(true)
      setError('')
      const q = status ? `?status=${encodeURIComponent(status)}` : ''
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/holds${q}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load holds')
      setRows(data.holds || [])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status])

  async function act(path, method = 'PATCH') {
    try {
      setLoading(true)
      const resp = await fetchWithAuth(`${API_URL}${path}`, { method })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Action failed')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2>Holds — Financial Manager</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={ctrl}>
          <option value="">All</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved (Active Block)</option>
          <option value="pending_override_ceo">Pending CEO Override Approval</option>
          <option value="override_ceo_approved">CEO Approved Override</option>
          <option value="unblocked">Unblocked</option>
          <option value="expired">Expired</option>
          <option value="reserved">Reserved</option>
        </select>
        <button onClick={load} disabled={loading} style={btn}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Unit</th>
              <th style={th}>Plan</th>
              <th style={th}>Status</th>
              <th style={th}>Expires</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.unit_id}</td>
                <td style={td}>{r.payment_plan_id || ''}</td>
                <td style={td}>{r.status}</td>
                <td style={td}>{r.expires_at ? new Date(r.expires_at).toLocaleString() : ''}</td>
                <td style={td}>
                  {r.status === 'pending_approval' && (
                    <button onClick={() => act(`/api/inventory/holds/${r.id}/approve`)} style={btn}>Approve</button>
                  )}
                  {r.status === 'approved' && (
                    <>
                      <button onClick={() => act(`/api/inventory/holds/${r.id}/unblock`)} style={btn}>Unblock</button>
                      <button onClick={() => act(`/api/inventory/holds/${r.id}/extend`)} style={btn}>Extend +7d</button>
                      <button onClick={() => act(`/api/inventory/holds/${r.id}/override-request`, 'POST')} style={btn}>Request Override</button>
                    </>
                  )}
                  {r.status === 'override_ceo_approved' && (
                    <button onClick={() => act(`/api/inventory/holds/${r.id}/override-unblock`)} style={btn}>Override Unblock</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td style={td} colSpan={6}>No holds.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }
const ctrl = { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6' }
const btn = { marginLeft: 6, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }