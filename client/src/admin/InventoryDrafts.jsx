import React, { useEffect, useState } from 'react'
import BrandHeader from '../lib/BrandHeader.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, btn, btnPrimary, tableWrap, table, pageContainer, pageTitle, metaText, errorText } from '../lib/ui.js'

export default function InventoryDrafts() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(0)

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
      setUnits(data.units || [])
    } catch (e) {
      setError(e.message || String(e))
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
    } catch (e) {
      alert(e.message || String(e))
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
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

  return (
    <div>
      <BrandHeader onLogout={handleLogout} />
      <div style={pageContainer}>
        <h2 style={pageTitle}>Inventory Drafts Approval (Financial Manager)</h2>
        {error ? <p style={errorText}>{error}</p> : null}
        {loading ? <p style={metaText}>Loading…</p> : null}
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Code</th>
                <th style={th}>Created By</th>
                <th style={th}>Status</th>
                <th style={th}>Created At</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map(u => (
                <tr key={u.id}>
                  <td style={td}>{u.id}</td>
                  <td style={td}>{u.code}</td>
                  <td style={td}>{u.created_by || '-'}</td>
                  <td style={td}>{u.unit_status}</td>
                  <td style={td}>{(u.created_at || '').replace('T', ' ').replace('Z', '')}</td>
                  <td style={td}>
                    <button disabled={busyId === u.id} onClick={() => approve(u.id)} style={btnPrimary}>Approve</button>
                    <button disabled={busyId === u.id} onClick={() => reject(u.id)} style={btn}>Reject</button>
                  </td>
                </tr>
              ))}
              {units.length === 0 && !loading && (
                <tr>
                  <td style={td} colSpan={6}>No drafts awaiting approval.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={metaText}>
          Notes: Draft units are created by Financial Admin with code only. Once approved, they become AVAILABLE and can be linked to models
          via the Unit-Model link workflow. Rejected drafts will be marked INVENTORY_REJECTED with your reason stored in metadata.
        </p>
      </div>
    </div>
  )
}