import React, { useEffect, useState } from 'react'
import BrandHeader from '../lib/BrandHeader.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, btn, btnPrimary, tableWrap, table, pageContainer, pageTitle, metaText, errorText } from '../lib/ui.js'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function InventoryDrafts() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(0)
  // Removed linkMap: model linking requests are disabled; units are created already linked to a model

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

  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/drafts`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load drafts')
      const list = data.units || []
      setUnits(list)

      // Model linking requests are disabled; units are created already linked to a model.
      // No additional fetch required here.
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function approve(id) {
    if (!confirm('Approve this draft unit and make it AVAILABLE?')) return
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/${id}/approve`, { method: 'PATCH' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approve failed')
      setUnits(list => list.filter(u => u.id !== id))
      notifySuccess('Unit approved')
    } catch (e) {
      notifyError(e, 'Approve failed')
    } finally {
      setBusyId(0)
    }
  }

  async function reject(id) {
    const reason = prompt('Reason for rejection (optional):') || ''
    if (!confirm('Reject this draft unit?')) return
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Reject failed')
      setUnits(list => list.filter(u => u.id !== id))
      notifySuccess('Unit rejected')
    } catch (e) {
      notifyError(e, 'Reject failed')
    } finally {
      setBusyId(0)
    }
  }

  // Removed renderLinkCell: drafts now show direct model info from API

  return (
    <div>
      <BrandHeader onLogout={handleLogout} />
      <div style={pageContainer}>
        <h2 style={pageTitle}>Inventory Drafts Approval (Financial Manager)</h2>
        {error ? <p style={errorText}>{error}</p> : null}
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Code</th>
                <th style={th}>Unit Model</th>
                <th style={th}>Created By</th>
                <th style={th}>Status</th>
                <th style={th}>Created At</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <SkeletonRow key={i} widths={['sm','lg','lg','lg','sm','lg','lg']} tdStyle={td} />
                  ))}
                </>
              )}
              {!loading && units.map(u => (
                <tr key={u.id}>
                  <td style={td}>{u.id}</td>
                  <td style={td}>{u.code}</td>
                  <td style={td}>{u.model_code ? `${u.model_code} — ${u.model_name || ''}`.trim() : (u.model_name || (u.model_id ? `#${u.model_id}` : '-'))}</td>
                  <td style={td}>{u.created_by_email || '-'}</td>
                  <td style={td}>{u.unit_status}</td>
                  <td style={td}>{(u.created_at || '').replace('T', ' ').replace('Z', '')}</td>
                  <td style={td}>
                    <LoadingButton disabled={busyId === u.id} onClick={() => approve(u.id)} loading={busyId === u.id} variant="primary">Approve</LoadingButton>
                    <LoadingButton disabled={busyId === u.id} onClick={() => reject(u.id)} loading={busyId === u.id} style={btn}>Reject</LoadingButton>
                  </td>
                </tr>
              ))}
              {units.length === 0 && !loading && (
                <tr>
                  <td style={td} colSpan={8}>No drafts awaiting approval.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={metaText}>
          Notes: Draft units are created by Financial Admin already linked to a Unit Model with approved standard pricing. Once approved, they become AVAILABLE.
        </p>
      </div>
    </div>
  )
}