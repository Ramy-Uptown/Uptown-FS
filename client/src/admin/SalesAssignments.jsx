import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { ctrl, btn, pageContainer, pageTitle, errorText, metaText } from '../lib/ui.js'

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
      setError(e.message || String(e))
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
      alert('Assignment updated.')
    } catch (e) {
      alert(e.message || String(e))
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
      alert('Assignment updated.')
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
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
          <button onClick={assign} disabled={loading} style={btn}>Assign</button>
          <button onClick={updateActive} disabled={loading} style={btn}>Update</button>
        </div>
      </div>

      <p style={metaText}>
        Tip: Use the Users or Sales Team pages to find user IDs. This page lets you assign/unassign manager-consultant pairs.
      </p>
    </div>
  )
}

