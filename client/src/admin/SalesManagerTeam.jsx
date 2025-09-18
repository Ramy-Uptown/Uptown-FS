import React, { useEffect, useState } from 'react'
import BrandHeader from '../lib/BrandHeader.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { ctrl, btn, btnPrimary, pageContainer, pageTitle, tableWrap, table, th, td, metaText, errorText } from '../lib/ui.js'

export default function SalesManagerTeam() {
  const [memberships, setMemberships] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Quick-assign controls
  const [consultantSearch, setConsultantSearch] = useState('')
  const [managerSearch, setManagerSearch] = useState('')
  const [consultantId, setConsultantId] = useState('')
  const [managerId, setManagerId] = useState('')

  const [consultants, setConsultants] = useState([])
  const [managers, setManagers] = useState([])

  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const canAssign = me?.role === 'admin' || me?.role === 'superadmin'

  useEffect(() => {
    load()
    // preload lists
    loadUsers('property_consultant', setConsultants)
    loadUsers('sales_manager', setManagers)
    // Do NOT default manager to self; sales managers are not authorized to assign.
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/memberships?active=true`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load memberships')
      setMemberships(data.memberships || [])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadUsers(role, setter) {
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/by-role?role=${encodeURIComponent(role)}`)
      const data = await resp.json()
      if (resp.ok) {
        setter(data.users || [])
      }
    } catch {}
  }

  async function assign() {
    if (!consultantId) return alert('Select a consultant')
    if (!managerId) return alert('Select a manager')
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultant_user_id: Number(consultantId), manager_user_id: Number(managerId) })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Assign failed')
      setConsultantId(''); setConsultantSearch('')
      // keep managerId (often assigning to self repeatedly)
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  async function clearMembership(mgr, con) {
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_user_id: Number(mgr), consultant_user_id: Number(con), active: false })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to clear')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  const filteredConsultants = consultants.filter(u => {
    if (!consultantSearch) return true
    const q = consultantSearch.toLowerCase()
    return String(u.email || '').toLowerCase().includes(q) ||
           String(u.meta?.full_name || '').toLowerCase().includes(q) ||
           String(u.id).includes(q)
  })
  const filteredManagers = managers.filter(u => {
    if (!managerSearch) return true
    const q = managerSearch.toLowerCase()
    return String(u.email || '').toLowerCase().includes(q) ||
           String(u.meta?.full_name || '').toLowerCase().includes(q) ||
           String(u.id).includes(q)
  })

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
        <h2 style={pageTitle}>Sales Team (Manager View)</h2>

        {canAssign ? (
          <div style={{ border: '1px solid #ead9bd', borderRadius: 10, padding: 12, marginBottom: 12, background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input placeholder="Search consultant by name/email/id…" value={consultantSearch} onChange={e => setConsultantSearch(e.target.value)} style={ctrl} />
                <select value={consultantId} onChange={e => setConsultantId(e.target.value)} style={ctrl}>
                  <option value="">Select sales consultant…</option>
                  {filteredConsultants.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.email}{u.meta?.full_name ? ` — ${u.meta.full_name}` : ''} (id {u.id})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input placeholder="Search manager by name/email/id…" value={managerSearch} onChange={e => setManagerSearch(e.target.value)} style={ctrl} />
                <select value={managerId} onChange={e => setManagerId(e.target.value)} style={ctrl}>
                  <option value="">Select sales manager…</option>
                  {filteredManagers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.email}{u.meta?.full_name ? ` — ${u.meta.full_name}` : ''} (id {u.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button type="button" onClick={assign} style={btnPrimary} disabled={!consultantId || !managerId}>Assign</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid #ead9bd', borderRadius: 10, padding: 12, marginBottom: 12, background: '#fff' }}>
            <span style={metaText}>Read-only view. Only Admin and Superadmin can assign consultants to managers.</span>
          </div>
        )}

        {error ? <p style={errorText}>{error}</p> : null}

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Manager User ID</th>
                <th style={th}>Consultant User ID</th>
                <th style={th}>Active</th>
                <th style={th}>{canAssign ? 'Actions' : 'Actions (read-only)'}</th>
              </tr>
            </thead>
            <tbody>
              {(memberships || []).map((m, idx) => (
                <tr key={idx}>
                  <td style={td}>{m.manager_user_id} {m.manager_email ? <span style={metaText}>({m.manager_email})</span> : null}</td>
                  <td style={td}>{m.consultant_user_id} {m.consultant_email ? <span style={metaText}>({m.consultant_email})</span> : null}</td>
                  <td style={td}>{m.active ? 'Yes' : 'No'}</td>
                  <td style={td}>
                    {m.active && canAssign ? (
                      <button onClick={() => clearMembership(m.manager_user_id, m.consultant_user_id)} style={btn}>Clear</button>
                    ) : (
                      !canAssign ? <span style={metaText}>No actions</span> : null
                    )}
                  </td>
                </tr>
              ))}
              {memberships.length === 0 && !loading && (
                <tr>
                  <td style={td} colSpan={4}>No memberships.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}