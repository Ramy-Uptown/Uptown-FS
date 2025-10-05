import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, ctrl, btn, tableWrap, table, pageContainer, pageTitle, errorText } from '../lib/ui.js'
import BrandHeader from '../lib/BrandHeader.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function HoldsFM() {
  const [status, setStatus] = useState('approved')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [rowLoading, setRowLoading] = useState({})

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
      const q = status ? `?status=${encodeURIComponent(status)}` : ''
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/holds${q}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load holds')
      setRows(data.holds || [])
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load holds')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status])

  async function act(path, method = 'PATCH', id) {
    try {
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}${path}`, { method })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Action failed')
      notifySuccess('Action completed')
      await load()
    } catch (e) {
      notifyError(e, 'Action failed')
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  const canFM = role === 'financial_manager'

  const handleLogout = async () => {
    try {
      const rt = localStorage.getItem('refresh_token')
      if (rt) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt })
        }).catch(() => {})
      }
    } finally {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_user')
      window.location.href = '/login'
    }
  }

  return (
    <div>
      <BrandHeader onLogout={handleLogout} />
      <div style={pageContainer}>
        <h2 style={pageTitle}>Holds — {canFM ? 'Financial Manager' : 'Read Only'}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={ctrl} disabled={loading}>
            <option value="">All</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved (Active Block)</option>
            <option value="pending_override_ceo">Pending CEO Override Approval</option>
            <option value="override_ceo_approved">CEO Approved Override</option>
            <option value="unblocked">Unblocked</option>
            <option value="expired">Expired</option>
            <option value="reserved">Reserved</option>
          </select>
          <LoadingButton onClick={load} loading={loading} style={btn}>Refresh</LoadingButton>
        </div>
        {error ? <p style={errorText}>{error}</p> : null}
        <div style={tableWrap}>
          <table style={table}>
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
              {loading && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} widths={['sm','sm','sm','sm','sm','lg']} tdStyle={td} />
                  ))}
                </>
              )}
              {!loading && rows.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>{r.unit_id}</td>
                  <td style={td}>{r.payment_plan_id || ''}</td>
                  <td style={td}>{r.status}</td>
                  <td style={td}>{r.expires_at ? new Date(r.expires_at).toLocaleString() : ''}</td>
                  <td style={td}>
                    {canFM && r.status === 'pending_approval' && (
                      <LoadingButton onClick={() => act(`/api/inventory/holds/${r.id}/approve`, 'PATCH', r.id)} loading={rowLoading[r.id]}>Approve</LoadingButton>
                    )}
                    {canFM && r.status === 'approved' && (
                      <>
                        <LoadingButton onClick={() => act(`/api/inventory/holds/${r.id}/unblock`, 'PATCH', r.id)} loading={rowLoading[r.id]}>Unblock</LoadingButton>
                        <LoadingButton onClick={() => act(`/api/inventory/holds/${r.id}/extend`, 'PATCH', r.id)} loading={rowLoading[r.id]}>Extend +7d</LoadingButton>
                        <LoadingButton onClick={() => act(`/api/inventory/holds/${r.id}/override-request`, 'POST', r.id)} loading={rowLoading[r.id]}>Request Override</LoadingButton>
                      </>
                    )}
                    {canFM && r.status === 'override_ceo_approved' && (
                      <LoadingButton onClick={() => act(`/api/inventory/holds/${r.id}/override-unblock`, 'PATCH', r.id)} loading={rowLoading[r.id]}>Override Unblock</LoadingButton>
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
    </div>
  )
}

