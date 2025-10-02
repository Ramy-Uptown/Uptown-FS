import React, { useEffect, useState } from 'react'
import BrandHeader from '../lib/BrandHeader.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { ctrl, btn, btnPrimary, pageContainer, pageTitle, tableWrap, table, th, td, metaText, errorText } from '../lib/ui.js'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function SalesManagerTeam() {
  const [memberships, setMemberships] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rowLoading, setRowLoading] = useState({}) // per-membership action loading
  const [assigning, setAssigning] = useState(false)

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
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load memberships')
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
    if (!consultantId) { notifyError('Select a consultant'); return }
    if (!managerId) { notifyError('Select a manager'); return }
    try {
      setAssigning(true)
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultant_user_id: Number(consultantId), manager_user_id: Number(managerId) })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Assign failed')
      setConsultantId(''); setConsultantSearch('')
      notifySuccess('Consultant assigned')
      // keep managerId (often assigning to self repeatedly)
      await load()
    } catch (e) {
      notifyError(e, 'Assign failed')
    } finally {
      setAssigning(false)
    }
  }

  async function clearMembership(mgr, con) {
    const key = `${mgr}:${con}`
    try {
      setRowLoading(s => ({ ...s, [key]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_user_id: Number(mgr), consultant_user_id: Number(con), active: false })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to clear')
      notifySuccess('Membership cleared')
      await load()
    } catch (e) {
      notifyError(e, 'Failed to clear membership')
    } finally {
      setRowLoading(s => ({ ...s, [key]: false }))
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
                <LoadingButton type="button" onClick={assign} loading={assigning} variant="primary" disabled={!consultantId || !managerId}>Assign</LoadingButton>
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
              {loading && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} widths={['lg','lg','sm','lg']} tdStyle={td} />
                  ))}
                </>
              )}
              {!loading && (memberships || []).map((m, idx) => {
                const key = `${m.manager_user_id}:${m.consultant_user_id}`
                return (
                <tr key={idx}>
                  <td style={td}>{m.manager_user_id} {m.manager_email ? <span style={metaText}>({m.manager_email})</span> : null}</td>
                  <td style={td}>{m.consultant_user_id} {m.consultant_email ? <span style={metaText}>({m.consultant_email})</span> : null}</td>
                  <td style={td}>{m.active ? 'Yes' : 'No'}</td>
                  <td style={td}>
                    {m.active && canAssign ? (
                      <LoadingButton onClick={() => clearMembership(m.manager_user_id, m.consultant_user_id)} loading={rowLoading[key]}>Clear</LoadingButton>
                    ) : (
                      !canAssign ? <span style={metaText}>No actions</span> : null
                    )}
                  </td>
                </tr>
              )})}
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