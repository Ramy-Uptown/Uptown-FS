import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BrandHeader from '../lib/BrandHeader.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { pageContainer, pageTitle, errorText, metaText, ctrl, btn, btnPrimary, btnDanger, table, th, td, tableWrap } from '../lib/ui.js'
import LoadingButton from '../components/LoadingButton.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function UserEdit() {
  const { id } = useParams()
  const uid = Number(id)
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // form state
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [active, setActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [fullName, setFullName] = useState('') // extracted from meta.full_name
  const [metaTextState, setMetaTextState] = useState('{}')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')

  // manager assign
  const [allUsers, setAllUsers] = useState([])
  const [assignManagerId, setAssignManagerId] = useState('')
  const [currentManagerId, setCurrentManagerId] = useState('')
  const [audit, setAudit] = useState([])

  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const isSuperAdmin = me?.role === 'superadmin'
  const isAdmin = me?.role === 'admin'

  const roleOptions = [
    'user',
    'admin',
    'superadmin',
    'manager',
    'sales_manager',
    'property_consultant',
    'financial_manager',
    'financial_admin',
    'contract_manager',
    'contract_person',
    'chairman',
    'vice_chairman',
    'ceo'
  ]

  const managers = allUsers.filter(u =>
    u.role === 'sales_manager' ||
    u.role === 'manager' ||
    u.role === 'contract_manager' ||
    u.role === 'financial_manager'
  )
  const currentManagerEmail = useMemo(() => {
    const m = allUsers.find(u => u.id === Number(currentManagerId))
    return m ? m.email : ''
  }, [allUsers, currentManagerId])

  const canAssignManager = ['property_consultant', 'financial_admin', 'contract_person'].includes(role)

  useEffect(() => {
    load()
  }, [uid])

  async function load() {
    try {
      setError('')
      const [uResp, listResp, memResp, auditResp] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/auth/users/${uid}`),
        fetchWithAuth(`${API_URL}/api/auth/users`),
        fetchWithAuth(`${API_URL}/api/workflow/sales-teams/memberships?consultant_user_id=${uid}&active=true`).catch(() => null),
        fetchWithAuth(`${API_URL}/api/auth/users/${uid}/audit`).catch(() => null)
      ])
      const uData = await uResp.json()
      if (!uResp.ok) throw new Error(uData?.error?.message || 'Failed to load user')
      setUser(uData.user)
      setEmail(uData.user.email || '')
      setRole(uData.user.role || 'user')
      setActive(uData.user.active !== false)
      setNotes(uData.user.notes || '')
      setFullName((uData.user.meta && uData.user.meta.full_name) || '')
      setMetaTextState(JSON.stringify(uData.user.meta || {}, null, 2))

      const listData = await listResp.json()
      if (listResp.ok) setAllUsers(listData.users || [])

      if (memResp) {
        const memData = await memResp.json()
        if (memResp.ok) {
          const m = (memData.memberships || [])[0]
          setCurrentManagerId(m ? String(m.manager_user_id) : '')
          setAssignManagerId(m ? String(m.manager_user_id) : '')
        }
      }

      if (auditResp) {
        const aData = await auditResp.json()
        if (auditResp.ok) setAudit(aData.audit || [])
      }
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  async function saveBasics(e) {
    e && e.preventDefault()
    setBusy(true)
    try {
      // email, notes, meta
      let metaObj = {}
      try {
        metaObj = metaTextState ? JSON.parse(metaTextState) : {}
      } catch (e) {
        notifyError('Metadata must be valid JSON')
        return
      }
      // Enforce name edit permissions: only superadmin can change full_name
      if (isSuperAdmin) {
        metaObj.full_name = fullName
      } else {
        // keep existing full_name; prevent admin from altering name through JSON
        const existing = (user && user.meta && user.meta.full_name) || ''
        metaObj.full_name = existing
      }
      const payload = { notes, meta: metaObj }
      // Only superadmin can change email
      payload.email = isSuperAdmin ? email : (user?.email || email)

      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to save')
      setUser(data.user)
      // refresh local fields from server
      setFullName((data.user.meta && data.user.meta.full_name) || '')
      setMetaTextState(JSON.stringify(data.user.meta || {}, null, 2))
      notifySuccess('Saved')
    } catch (e) {
      notifyError(e, 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  async function saveRole() {
    setBusy(true)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${uid}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to update role')
      setUser(data.user)
      notifySuccess('Role updated')
    } catch (e) {
      notifyError(e, 'Failed to update role')
    } finally {
      setBusy(false)
    }
  }

  async function saveActive() {
    setBusy(true)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${uid}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to update status')
      setUser(data.user)
      notifySuccess('Status updated')
    } catch (e) {
      notifyError(e, 'Failed to update status')
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(e) {
    e && e.preventDefault()
    if (!pw1 || pw1.length < 6) { notifyError('Password must be at least 6 characters'); return }
    if (pw1 !== pw2) { notifyError('Passwords do not match'); return }
    setBusy(true)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${uid}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pw1 })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to set password')
      setPw1(''); setPw2('')
      notifySuccess('Password updated')
    } catch (e) {
      notifyError(e, 'Failed to set password')
    } finally {
      setBusy(false)
    }
  }

  async function assignManager() {
    if (!assignManagerId) return alert('Select a manager')
    setBusy(true)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(assignManagerId),
          consultant_user_id: uid
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to assign manager')
      setCurrentManagerId(assignManagerId)
      alert('Manager assigned.')
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function clearManager() {
    if (!currentManagerId) return alert('No current manager to clear.')
    setBusy(true)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(currentManagerId),
          consultant_user_id: uid,
          active: false
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to clear manager')
      setCurrentManagerId('')
      setAssignManagerId('')
      alert('Manager cleared.')
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
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

  if (!user) {
    return (
      <div>
        <BrandHeader onLogout={handleLogout} />
        <div style={{ ...pageContainer, maxWidth: 800 }}>
          <h2 style={pageTitle}>Edit User</h2>
          {error ? <p style={errorText}>{error}</p> : <p style={metaText}>Loading…</p>}
        </div>
      </div>
    )
  }

  const isSelf = me.id === user.id

  return (
    <div>
      <BrandHeader onLogout={handleLogout} />
      <div style={{ ...pageContainer, maxWidth: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={pageTitle}>Edit User #{user.id}</h2>
          <button type="button" onClick={() => navigate('/admin/users')} style={btn}>Back</button>
        </div>

        {error ? <p style={errorText}>{error}</p> : null}

        <form onSubmit={saveBasics} style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          <label>
            <div style={metaText}>Email</div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={ctrl} required disabled={!isSuperAdmin} />
            {!isSuperAdmin && <div style={{ ...metaText, marginTop: 4 }}>Only Superadmin can edit email</div>}
          </label>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>
              <div style={metaText}>Role</div>
              <select value={role} onChange={e => setRole(e.target.value)} disabled={isSelf || !isSuperAdmin} style={ctrl}>
                {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={isSelf} />
              <span style={metaText}>Active</span>
            </div>
          </div>

          <label>
            <div style={metaText}>Full Name</div>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={ctrl} disabled={!isSuperAdmin} placeholder="Employee full name" />
            {!isSuperAdmin && <div style={{ ...metaText, marginTop: 4 }}>Only Superadmin can edit name</div>}
          </label>

          <label>
            <div style={metaText}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} style={{ ...ctrl, minHeight: 80 }} placeholder="Internal notes..." />
          </label>

          <label>
            <div style={metaText}>Metadata (JSON)</div>
            <textarea value={metaTextState} onChange={e => setMetaTextState(e.target.value)} rows={6} style={{ ...ctrl, fontFamily: 'monospace', minHeight: 120 }} placeholder='{"key":"value"}' />
            {!isSuperAdmin && <div style={{ ...metaText, marginTop: 4 }}>Note: Name is managed separately and cannot be changed by Admin.</div>}
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy} style={btnPrimary}>Save email/notes/meta</button>
            <button type="button" onClick={saveRole} disabled={busy || isSelf || !isSuperAdmin} style={btn}>Save role</button>
            <button type="button" onClick={saveActive} disabled={busy || isSelf} style={btnDanger}>{active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </form>

        {canAssignManager && (
          <div style={{ marginTop: 24, marginBottom: 24 }}>
            <h3 style={{ ...pageTitle, fontSize: 18 }}>Manager Assignment</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={assignManagerId} onChange={e => setAssignManagerId(e.target.value)} style={ctrl}>
                <option value="">Select manager…</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.email} (id {m.id})</option>)}
              </select>
              <LoadingButton type="button" onClick={assignManager} disabled={busy || !assignManagerId}>Assign</LoadingButton>
              {currentManagerId ? <LoadingButton type="button" onClick={clearManager} disabled={busy} style={btnDanger}>Clear</LoadingButton> : null}
              <span style={metaText}>{currentManagerId ? `Current: ${currentManagerEmail}` : 'No manager assigned'}</span>
            </div>
          </div>
        )}

        <form onSubmit={savePassword} style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          <h3 style={{ ...pageTitle, fontSize: 18 }}>Set Password</h3>
          <input type="password" placeholder="New password" value={pw1} onChange={e => setPw1(e.target.value)} style={ctrl} />
          <input type="password" placeholder="Confirm new password" value={pw2} onChange={e => setPw2(e.target.value)} style={ctrl} />
          <button type="submit" disabled={busy} style={btn}>Update Password</button>
          <p style={metaText}>Note: Updating a password invalidates existing sessions.</p>
        </form>

        <div style={{ marginTop: 24 }}>
          <h3 style={{ ...pageTitle, fontSize: 18 }}>Audit History</h3>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>When</th>
                  <th style={th}>Action</th>
                  <th style={th}>By (user id)</th>
                  <th style={th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(a => (
                  <tr key={a.id}>
                    <td style={td}>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</td>
                    <td style={td}>{a.action}</td>
                    <td style={td}>{a.changed_by}</td>
                    <td style={td}>
                      <code style={{ fontSize: 12 }}>{a.details ? JSON.stringify(a.details) : ''}</code>
                    </td>
                  </tr>
                ))}
                {audit.length === 0 && (
                  <tr>
                    <td style={td} colSpan={4}><span style={metaText}>No audit items.</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}