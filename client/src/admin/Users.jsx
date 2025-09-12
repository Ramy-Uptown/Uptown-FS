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
  const [statusFilter, setStatusFilter] = useState('active') // 'active' | 'inactive' | 'all'
  const [roleFilter, setRoleFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [assignMap, setAssignMap] = useState({}) // { [userId]: managerId }
  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setError('')
      const [usersResp, memResp] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/auth/users`),
        fetchWithAuth(`${API_URL}/api/workflow/sales-teams/memberships?active=true`).catch(() => null)
      ])
      const usersData = await usersResp.json()
      if (!usersResp.ok) throw new Error(usersData?.error?.message || 'Failed to load users')
      setUsers(usersData.users || [])

      if (memResp) {
        const memData = await memResp.json()
        if (memResp.ok) {
          const map = {}
          ;(memData.memberships || []).forEach(m => {
            map[m.consultant_user_id] = String(m.manager_user_id)
          })
          setAssignMap(map)
        }
      }
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

  async function assignManager(userId) {
    const managerId = Number(assignMap[userId] || 0)
    if (!managerId) {
      alert('Please select a manager first.')
      return
    }
    setBusyId(userId)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: managerId,
          consultant_user_id: userId
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to assign manager')
      alert('Manager assigned.')
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

  async function clearManager(userId) {
    const currentManagerId = Number(assignMap[userId] || 0)
    if (!currentManagerId) {
      alert('No current manager to clear.')
      return
    }
    setBusyId(userId)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: currentManagerId,
          consultant_user_id: userId,
          active: false
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to clear manager')
      setAssignMap(s => {
        const copy = { ...s }
        delete copy[userId]
        return copy
      })
      alert('Manager cleared.')
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

  const filteredUsers = users.filter(u => {
    // status
    if (statusFilter !== 'all') {
      const isActive = u.active !== false
      if (statusFilter === 'active' && !isActive) return false
      if (statusFilter === 'inactive' && isActive) return false
    }
    // role
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    // search
    const q = searchText.trim().toLowerCase()
    if (q) {
      const metaStr = u.meta ? JSON.stringify(u.meta).toLowerCase() : ''
      const notesStr = (u.notes || '').toLowerCase()
      const emailStr = (u.email || '').toLowerCase()
      if (![emailStr, notesStr, metaStr].some(s => s.includes(q))) return false
    }
    return true
  })

  const activeCount = users.filter(u => u.active !== false).length
  const inactiveCount = users.filter(u => u.active === false).length

  const managers = users.filter(u =>
    u.role === 'sales_manager' ||
    u.role === 'manager' ||
    u.role === 'contract_manager' ||
    u.role === 'financial_manager'
  )
  const userById = Object.fromEntries(users.map(u => [u.id, u]))

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

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={ctrl}>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">All</option>
          </select>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={ctrl}>
            <option value="all">All roles</option>
            {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="text" placeholder="Search email, notes, meta…" value={searchText} onChange={e => setSearchText(e.target.value)} style={{ ...ctrl, minWidth: 220 }} />
          <span style={metaText}>Active: {activeCount} • Inactive: {inactiveCount}</span>
        </div>

        {error ? <p style={errorText}>{error}</p> : null}
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Manager</th>
                <th style={th}>Notes</th>
                <th style={th}>Meta</th>
                <th style={th}>Active</th>
                <th style={th}>Created</th>
                <th style={th}>Updated</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const isEditing = editingId === u.id
                const isSelf = me.id === u.id
                const canAssignManager = ['property_consultant', 'financial_admin', 'contract_person'].includes(u.role)
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
                      {canAssignManager ? (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                              value={assignMap[u.id] || ''}
                              onChange={e => setAssignMap(s => ({ ...s, [u.id]: e.target.value }))}
                              style={ctrl}
                            >
                              <option value="">Select manager…</option>
                              {managers.map(m => (
                                <option key={m.id} value={m.id}>{m.email} (id {m.id})</option>
                              ))}
                            </select>
                            <button type="button" onClick={() => assignManager(u.id)} disabled={busyId === u.id || !assignMap[u.id]} style={btn}>Assign</button>
                            {assignMap[u.id] ? (
                              <button type="button" onClick={() => clearManager(u.id)} disabled={busyId === u.id} style={btnDanger} title="Deactivate current manager assignment">
                                Clear
                              </button>
                            ) : null}
                          </div>
                          <div style={metaText}>
                            {assignMap[u.id]
                              ? `Current manager: ${userById[Number(assignMap[u.id])] ? userById[Number(assignMap[u.id])].email : '(' + assignMap[u.id] + ')' }`
                              : 'No manager assigned'}
                          </div>
                        </div>
                      ) : (
                        <span style={metaText}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      {(u.notes || '').length ? (u.notes.length > 60 ? u.notes.slice(0, 60) + '…' : u.notes) : <span style={metaText}>—</span>}
                    </td>
                    <td style={td}>
                      {u.meta ? (
                        <span style={metaText}>
                          {Array.isArray(u.meta) ? `array (${u.meta.length})` : `keys: ${Object.keys(u.meta || {}).length}`}
                        </span>
                      ) : <span style={metaText}>—</span>}
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
                        <a href={`/admin/users/${u.id}`} style={btn}>Edit</a>
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
              {filteredUsers.length === 0 && (
                <tr>
                  <td style={td} colSpan={8}>No users.</td>
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


