import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, tableWrap, table, pageContainer, pageTitle, errorText, metaText, ctrl, btn, btnPrimary, btnDanger } from '../lib/ui.js'
import BrandHeader from '../lib/BrandHeader.jsx'

export default function Users() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(0)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'user' })
  const [editingId, setEditingId] = useState(0)
  const [editEmail, setEditEmail] = useState('')
  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load users')
      setUsers(data.users || [])
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  async function changeRole(id, role) {
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to update role')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

  async function toggleActive(u) {
    setBusyId(u.id)
    try {
      const next = !u.active
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${u.id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to update active')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

  async function deactivateUser(u) {
    if (!confirm('Deactivate this user? They will not be able to login, but their data will be preserved.')) return
    setBusyId(u.id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${u.id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to deactivate user')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

  async function startEdit(u) {
    setEditingId(u.id)
    setEditEmail(u.email || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveEmail(id) {
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editEmail })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to update email')
      setEditingId(0)
      setEditEmail('')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

  async function createUser(e) {
    e && e.preventDefault()
    try {
      setCreating(true)
      const body = { email: createForm.email, password: createForm.password, role: createForm.role }
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to create user')
      setCreateForm({ email: '', password: '', role: 'user' })
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setCreating(false)
    }
  }

  async function deleteUser(u) {
    if (!confirm('Delete this user?')) return
    setBusyId(u.id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${u.id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Delete failed')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

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
      <div style={{ ...pageContainer, maxWidth: 1000 }}>
        <h2 style={pageTitle}>Users</h2>

        {/* Create user form */}
        <form onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: 8, marginBottom: 12 }}>
          <input type="email" placeholder="Email" value={createForm.email} onChange={e => setCreateForm(s => ({ ...s, email: e.target.value }))} style={ctrl} required />
          <input type="password" placeholder="Password (min 6 chars)" value={createForm.password} onChange={e => setCreateForm(s => ({ ...s, password: e.target.value }))} style={ctrl} required />
          <select value={createForm.role} onChange={e => setCreateForm(s => ({ ...s, role: e.target.value }))} style={ctrl}>
            {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" disabled={creating} style={btnPrimary}>{creating ? 'Creating…' : 'Create'}</button>
        </form>

        {error ? <p style={errorText}>{error}</p> : null}
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Active</th>
                <th style={th}>Created</th>
                <th style={th}>Updated</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isEditing = editingId === u.id
                const isSelf = me.id === u.id
                return (
                  <tr key={u.id}>
                    <td style={td}>{u.id}</td>
                    <td style={td}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input value={editEmail} onChange={e => setEditEmail(e.target.value)} style={ctrl} />
                          <button type="button" onClick={() => saveEmail(u.id)} disabled={busyId === u.id} style={btnPrimary}>Save</button>
                          <button type="button" onClick={() => { setEditingId(0); setEditEmail('') }} style={btn}>Cancel</button>
                        </div>
                      ) : (
                        u.email
                      )}
                    </td>
                    <td style={td}>
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        disabled={busyId === u.id || isSelf}
                        style={ctrl}
                      >
                        {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={!!u.active} onChange={() => toggleActive(u)} disabled={busyId === u.id || isSelf} />
                        {u.active ? 'Active' : 'Inactive'}
                      </label>
                    </td>
                    <td style={td}>{u.created_at ? new Date(u.created_at).toLocaleString() : ''}</td>
                    <td style={td}>{u.updated_at ? new Date(u.updated_at).toLocaleString() : ''}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!isEditing && <button type="button" onClick={() => startEdit(u)} disabled={busyId === u.id} style={btn}>Edit Email</button>}
                        {!isSelf && u.active !== false && (
                          <button
                            type="button"
                            onClick={() => deactivateUser(u)}
                            disabled={busyId === u.id}
                            style={btnDanger}
                            title="Deactivate user (keeps data; prevents login)"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td style={td} colSpan={7}>No users.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ ...metaText, marginTop: 8 }}>
          Notes:
          <br />• You cannot change your own role or deactivate/delete your own account.
          <br />• Admins cannot create, modify, or delete superadmin accounts. Superadmins can manage all.
        </p>
      </div>
    </div>
  )
}

