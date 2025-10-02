import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, btn, tableWrap, table, pageContainer, pageTitle, errorText } from '../lib/ui.js'
import BrandHeader from '../lib/BrandHeader.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function HoldsCEO() {
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
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/holds?status=pending_override_ceo`)
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
  useEffect(() => { load() }, [])

  async function approve(id) {
    try {
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/holds/${id}/override-approve`, { method: 'PATCH' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approve failed')
      notifySuccess('Override approved')
      await load()
    } catch (e) {
      notifyError(e, 'Approve failed')
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  const canCEO = role === 'ceo'

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
      <div style={{ ...pageContainer, maxWidth: 900 }}>
        <h2 style={pageTitle}>Hold Override Approvals — {canCEO ? 'CEO' : 'Read Only'}</h2>
        <LoadingButton onClick={load} loading={loading} style={btn}>Refresh</LoadingButton>
        {error ? <p style={errorText}>{error}</p> : null}
        <div style={{ ...tableWrap, marginTop: 12 }}>
          <table style={table}>
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
              {loading && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} widths={['sm','sm','sm','lg','sm','lg']} tdStyle={td} />
                  ))}
                </>
              )}
              {!loading && rows.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>{r.unit_id}</td>
                  <td style={td}>{r.payment_plan_id || ''}</td>
                  <td style={td}>{r.requested_by || ''}</td>
                  <td style={td}>{r.expires_at ? new Date(r.expires_at).toLocaleString() : ''}</td>
                  <td style={td}>
                    {canCEO ? <LoadingButton onClick={() => approve(r.id)} loading={rowLoading[r.id]}>Approve Override</LoadingButton> : <span style={{ color: '#64748b' }}>View only</span>}
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
    </div>
  )
}

