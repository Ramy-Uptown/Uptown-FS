import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { ctrl, btn, pageContainer, pageTitle, errorText, metaText } from '../lib/ui.js'
import BrandHeader from '../lib/BrandHeader.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function SalesAssignments() {
  const [managerId, setManagerId] = useState('')
  const [consultantId, setConsultantId] = useState('')
  const [active, setActive] = useState(true)
  const [memberships, setMemberships] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    try {
      setLoading(true)
      setError('')
      // Minimal fetch: list latest assignments for quick view
      const resp = await fetchWithAuth(`${API_URL}/api/sales?role=property_consultant&page=1&pageSize=100`)
      const cons = await resp.json()
      // We do not have a list assignments endpoint, so this page focuses on assign/unassign actions
      setMemberships(cons.sales || [])
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function assign() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(managerId),
          consultant_user_id: Number(consultantId)
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Assign failed')
      notifySuccess('Assignment updated')
    } catch (e) {
      notifyError(e, 'Assign failed')
    } finally {
      setLoading(false)
    }
  }

  async function updateActive() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(managerId),
          consultant_user_id: Number(consultantId),
          active: !!active
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Update failed')
      notifySuccess('Assignment updated')
    } catch (e) {
      notifyError(e, 'Update failed')
    } finally {
      setLoading(false)
    }
  }

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
      <div style={{ ...pageContainer, maxWidth: 800 }}>
        <h2 style={pageTitle}>Sales Team Assignments</h2>
        {error ? <p style={errorText}>{error}</p> : null}

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
          <input placeholder="Manager User ID" value={managerId} onChange={e => setManagerId(e.target.value)} style={ctrl} />
          <input placeholder="Consultant User ID" value={consultantId} onChange={e => setConsultantId(e.target.value)} style={ctrl} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            Active
          </label>
          <div>
            <LoadingButton onClick={assign} loading={loading}>Assign</LoadingButton>
            <LoadingButton onClick={updateActive} loading={loading}>Update</LoadingButton>
          </div>
        </div>

        <p style={metaText}>
          Tip: Use the Users or Sales Team pages to find user IDs. This page lets you assign/unassign manager-consultant pairs.
        </p>
      </div>
    </div>
  )
}

