import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function Approvals() {
  const [deals, setDeals] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(0)
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const role = user?.role || 'user'

  useEffect(() => {
    async function load() {
      try {
        setError('')
        const resp = await fetchWithAuth(`${API_URL}/api/deals`)
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load deals')
        setDeals((data.deals || []).filter(d => d.status === 'pending_approval'))
      } catch (e) {
        setError(e.message || String(e))
      }
    }
    load()
  }, [])

  async function approve(id) {
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/approve`, { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approve failed')
      setDeals(ds => ds.filter(d => d.id !== id))
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

  async function reject(id) {
    const reason = prompt('Reason for rejection (optional):') || ''
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Reject failed')
      setDeals(ds => ds.filter(d => d.id !== id))
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

  if (!(role === 'sales_manager' || role === 'admin')) {
    return <p>Access denied. Sales Manager role required.</p>
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Pending Approvals</h2>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Title</th>
              <th style={th}>Amount</th>
              <th style={th}>Creator</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map(d => (
              <tr key={d.id}>
                <td style={td}>{d.id}</td>
                <td style={td}>{d.title}</td>
                <td style={{ ...td, textAlign: 'right' }}>{Number(d.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={td}>{d.created_by_email || '-'}</td>
                <td style={td}>
                  <button disabled={busyId === d.id} onClick={() => approve(d.id)} style={btn}>Approve</button>
                  <button disabled={busyId === d.id} onClick={() => reject(d.id)} style={btn}>Reject</button>
                </td>
              </tr>
            ))}
            {deals.length === 0 && (
              <tr>
                <td style={td} colSpan={5}>No pending deals.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }
const btn = { marginRight: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }