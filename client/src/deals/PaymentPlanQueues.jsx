import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { Link } from 'react-router-dom'

export default function PaymentPlanQueues() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('')

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
      setRole(user?.role || '')
    } catch {}
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError('')
      let url = ''
      if (role === 'sales_manager') {
        url = `${API_URL}/api/workflow/payment-plans/queue/sm`
      } else if (role === 'financial_manager') {
        url = `${API_URL}/api/workflow/payment-plans/queue/fm`
      } else if (['ceo', 'vice_chairman', 'chairman', 'top_management'].includes(role)) {
        url = `${API_URL}/api/workflow/payment-plans/queue/tm`
      } else {
        setError('Your role does not have an approval queue.')
        setRows([])
        return
      }
      const resp = await fetchWithAuth(url)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load queue')
      setRows(data.payment_plans || [])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (role) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  async function takeAction(id, action) {
    try {
      setLoading(true)
      setError('')
      let endpoint = ''
      if (role === 'sales_manager') {
        if (action === 'approve') endpoint = `${API_URL}/api/workflow/payment-plans/${id}/approve-sm`
        else endpoint = `${API_URL}/api/workflow/payment-plans/${id}/reject-sm`
      } else if (role === 'financial_manager') {
        if (action === 'approve') endpoint = `${API_URL}/api/workflow/payment-plans/${id}/approve`
        else endpoint = `${API_URL}/api/workflow/payment-plans/${id}/reject`
      } else {
        // Top-Management
        if (action === 'approve') endpoint = `${API_URL}/api/workflow/payment-plans/${id}/approve-tm`
        else endpoint = `${API_URL}/api/workflow/payment-plans/${id}/reject-tm`
      }
      const resp = await fetchWithAuth(endpoint, { method: 'PATCH' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Action failed')
      setRows(rows => rows.filter(r => r.id !== id))
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
  const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }
  const btn = { marginRight: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ marginTop: 0 }}>Payment Plan Approval Queue</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/deals" style={{ textDecoration: 'none', color: '#1f6feb' }}>Deals Dashboard</Link>
          <Link to="/deals/create" style={{ textDecoration: 'none', color: '#1f6feb' }}>Create Deal</Link>
        </div>
      </div>
      <p style={{ color: '#64748b' }}>
        Role: <strong>{role || 'unknown'}</strong>
        {' '}— Showing: {role === 'sales_manager' ? 'Sales-Manager queue (pending_sm)' :
          role === 'financial_manager' ? 'Finance-Manager queue (pending_fm)' :
          (['ceo', 'vice_chairman', 'chairman', 'top_management'].includes(role) ? 'Top-Management queue (pending_tm)' : 'None')}
      </p>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Deal</th>
              <th style={th}>Status</th>
              <th style={th}>Version</th>
              <th style={th}>Accepted</th>
              <th style={th}>Created</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.deal_id}</td>
                <td style={td}>{r.status}</td>
                <td style={td}>{r.version || 1}</td>
                <td style={td}>{r.accepted ? 'Yes' : 'No'}</td>
                <td style={td}>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                <td style={td}>
                  <button disabled={loading} onClick={() => takeAction(r.id, 'approve')} style={btn}>Approve</button>
                  <button disabled={loading} onClick={() => takeAction(r.id, 'reject')} style={btn}>Reject</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td style={td} colSpan={7}>No items in queue.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}