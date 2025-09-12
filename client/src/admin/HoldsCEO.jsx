import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, btn } from '../lib/ui.js'

export default function HoldsCEO() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth_user')
      if (raw) {
        const u = JSON.parse(raw)
        setRole(u?.role || '')
      }
    } catch {}
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/holds?status=pending_override_ceo`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load holds')
      setRows(data.holds || [])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function approve(id) {
    try {
      setLoading(true)
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/holds/${id}/override-approve`, { method: 'PATCH' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approve failed')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const canCEO = role === 'ceo'

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h2>Hold Override Approvals — {canCEO ? 'CEO' : 'Read Only'}</h2>
      <button onClick={load} disabled={loading} style={btn}>{loading ? 'Loading…' : 'Refresh'}</button>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12, marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Unit</th>
              <th style={th}>Plan</th>
              <th style={th}>Requested By</th>
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
                <td style={td}>{r.requested_by || ''}</td>
                <td style={td}>{r.expires_at ? new Date(r.expires_at).toLocaleString() : ''}</td>
                <td style={td}>
                  {canCEO ? <button onClick={() => approve(r.id)} style={btn}>Approve Override</button> : <span style={{ color: '#64748b' }}>View only</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td style={td} colSpan={6}>No pending requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

