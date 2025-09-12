import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BrandHeader from '../lib/BrandHeader.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { pageContainer, pageTitle, errorText, metaText, ctrl, btn, btnPrimary, btnDanger, table, th, td, tableWrap } from '../lib/ui.js'

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
  const [metaTextState, setMetaTextState] = useState('{}')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')

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

  useEffect(() => {
    load()
  }, [uid])

  async function load() {
    try {
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${uid}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load user')
      setUser(data.user)
      setEmail(data.user.email || '')
      setRole(data.user.role || 'user')
      setActive(data.user.active !== false)
      setNotes(data.user.notes || '')
      setMetaTextState(JSON.stringify(data.user.meta || {}, null, 2))
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
        alert('Metadata must be valid JSON')
        return
      }
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, notes, meta: metaObj })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to save')
      setUser(data.user)
      alert('Saved.')
    } catch (e) {
      alert(e.message || String(e))
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
      alert('Role updated.')
    } catch (e) {
      alert(e.message || String(e))
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
      alert('Status updated.')
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(e) {
    e && e.preventDefault()
    if (!pw1 || pw1.length < 6) return alert('Password must be at least 6 characters')
    if (pw1 !== pw2) return alert('Passwords do not match')
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
      alert('Password updated.')
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
      <div style={{ ...pageContainer, maxWidth: 800 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={pageTitle}>Edit User #{user.id}</h2>
          <button type="button" onClick={() => navigate('/admin/users')} style={btn}>Back</button>
        </div>

        {error ? <p style={errorText}>{error}</p> : null}

        <form onSubmit={saveBasics} style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          <label>
            <div style={metaText}>Email</div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={ctrl} required />
          </label>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>
              <div style={metaText}>Role</div>
              <select value={role} onChange={e => setRole(e.target.value)} disabled={isSelf} style={ctrl}>
                {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={isSelf} />
              <span style={metaText}>Active</span>
            </div>
          </div>

          <label>
            <div style={metaText}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} style={{ ...ctrl, minHeight: 80 }} placeholder="Internal notes..." />
          </label>

          <label>
            <div style={metaText}>Metadata (JSON)</div>
            <textarea value={metaTextState} onChange={e => setMetaTextState(e.target.value)} rows={6} style={{ ...ctrl, fontFamily: 'monospace', minHeight: 120 }} placeholder='{"key":"value"}' />
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy} style={btnPrimary}>Save email/notes/meta</button>
            <button type="button" onClick={saveRole} disabled={busy || isSelf} style={btn}>Save role</button>
            <button type="button" onClick={saveActive} disabled={busy || isSelf} style={btnDanger}>{active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </form>

        <form onSubmit={savePassword} style={{ display: 'grid', gap: 10 }}>
          <h3 style={{ ...pageTitle, fontSize: 18 }}>Set Password</h3>
          <input type="password" placeholder="New password" value={pw1} onChange={e => setPw1(e.target.value)} style={ctrl} />
          <input type="password" placeholder="Confirm new password" value={pw2} onChange={e => setPw2(e.target.value)} style={ctrl} />
          <button type="submit" disabled={busy} style={btn}>Update Password</button>
          <p style={metaText}>Note: Updating a password invalidates existing sessions.</p>
        </form>
      </div>
    </div>
  )
}