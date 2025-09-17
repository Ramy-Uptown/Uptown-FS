import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, ctrl, btn, btnPrimary, tableWrap, table, pageContainer, pageTitle, errorText, metaText } from '../lib/ui.js'
import BrandHeader from '../lib/BrandHeader.jsx'

export default function SalesTeam() {
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // current user
  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const isSuperAdmin = me?.role === 'superadmin'

  const [form, setForm] = useState({ user_id: '', name: '', email: '', role: 'sales', active: true })
  const [editingId, setEditingId] = useState(0)
  const [saving, setSaving] = useState(false)

  // Manager assignment state
  const [memberships, setMemberships] = useState({}) // { consultant_user_id: manager_user_id }
  const [allUsers, setAllUsers] = useState([]) // to find manager emails
  const [assignFor, setAssignFor] = useState(0) // sales row id currently being assigned
  const [assignManagerId, setAssignManagerId] = useState('')

  function randomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    let s = ''
    for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)]
    return s
  }

  async function load(p = page) {
    try {
      setLoading(true)
      setError('')
      const q = new URLSearchParams()
      if (search) q.set('search', search)
      q.set('page', String(p))
      q.set('pageSize', String(pageSize))
      const [resp, memResp, usersResp] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/sales?${q.toString()}`),
        fetchWithAuth(`${API_URL}/api/workflow/sales-teams/memberships?active=true`).catch(() => null),
        fetchWithAuth(`${API_URL}/api/auth/users`).catch(() => null)
      ])
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load sales team')
      setList(data.sales || [])
      setTotal(data.pagination?.total || 0)

      if (memResp) {
        const memData = await memResp.json()
        const map = {}
        ;(memData.memberships || []).forEach(m => { map[m.consultant_user_id] = String(m.manager_user_id) })
        setMemberships(map)
      }
      if (usersResp) {
        const usersData = await usersResp.json()
        setAllUsers(usersData.users || [])
      }
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [search, pageSize])
  useEffect(() => { load(page) }, [page])

  function resetForm() {
    setForm({ user_id: '', name: '', email: '', role: 'sales', active: true })
    setEditingId(0)
  }

  async function save(e) {
    e && e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        user_id: form.user_id ? Number(form.user_id) : null,
        name: form.name,
        email: form.email,
        role: form.role,
        active: !!form.active
      }
      let resp
      if (editingId) {
        resp = await fetchWithAuth(`${API_URL}/api/sales/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        resp = await fetchWithAuth(`${API_URL}/api/sales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Save failed')
      resetForm()
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function edit(row) {
    setEditingId(row.id)
    setForm({ user_id: row.user_id || '', name: row.name || '', email: row.email || '', role: row.role || 'sales', active: !!row.active })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(id) {
    if (!confirm('Delete this sales person?')) return
    const resp = await fetchWithAuth(`${API_URL}/api/sales/${id}`, { method: 'DELETE' })
    const data = await resp.json()
    if (!resp.ok) return alert(data?.error?.message || 'Delete failed')
    await load()
  }

  async function copyUserIdToClipboard(uid) {
    try {
      await navigator.clipboard.writeText(String(uid))
      alert('User ID copied')
    } catch {
      alert('Copy failed')
    }
  }

  async function autoLinkUser(row) {
    try {
      if (!row.email) {
        alert('This sales person has no email. Please set an email first.')
        return
      }
      const usersResp = await fetchWithAuth(`${API_URL}/api/auth/users`)
      const usersData = await usersResp.json()
      if (!usersResp.ok) throw new Error(usersData?.error?.message || 'Failed to fetch users')
      const email = String(row.email).trim().toLowerCase()
      const match = (usersData.users || []).find(u => String(u.email || '').toLowerCase() === email)
      let userId = match?.id
      if (!userId) {
        if (!confirm(`No app user found with email ${row.email}. Create one now?`)) return
        const pw = randomPassword()
        const createResp = await fetchWithAuth(`${API_URL}/api/auth/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pw, role: 'user', meta: { full_name: row.name || '' } })
        })
        const createData = await createResp.json()
        if (!createResp.ok) throw new Error(createData?.error?.message || 'User creation failed')
        userId = createData.user.id
        alert(`Created app user with id ${userId}. Temporary password generated.`)
      }
      // Link to sales row
      const patchResp = await fetchWithAuth(`${API_URL}/api/sales/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: Number(userId) })
      })
      const patchData = await patchResp.json()
      if (!patchResp.ok) throw new Error(patchData?.error?.message || 'Failed to link user')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  // Manager assignment handlers
  function openAssign(row) {
    setAssignFor(row.id)
    const currentMgr = row.user_id ? memberships[row.user_id] : ''
    setAssignManagerId(currentMgr || '')
  }

  async function saveAssign(row) {
    if (!row.user_id) {
      alert('This sales person is not linked to an app user. Please set user_id first.')
      return
    }
    if (!assignManagerId) {
      alert('Select a manager.')
      return
    }
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(assignManagerId),
          consultant_user_id: Number(row.user_id)
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to assign manager')
      setAssignFor(0)
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  async function clearAssign(row) {
    const currentMgr = row.user_id ? memberships[row.user_id] : ''
    if (!currentMgr) {
      setAssignFor(0)
      return
    }
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(currentMgr),
          consultant_user_id: Number(row.user_id),
          active: false
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to clear manager')
      setAssignFor(0)
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const userById = Object.fromEntries(allUsers.map(u => [u.id, u]))
  const managerCandidates = allUsers.filter(u =>
    u.role === 'sales_manager' || u.role === 'manager' || u.role === 'contract_manager' || u.role === 'financial_manager'
  )

  const canAssign = isSuperAdmin || me?.role === 'admin'

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
        <h2 style={pageTitle}>Sales Team</h2>

        <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
          <input placeholder="User ID (optional)" value={form.user_id} onChange={e => setForm(s => ({ ...s, user_id: e.target.value }))} style={ctrl} />
          <input placeholder="Name" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} style={ctrl} required />
          <input placeholder="Email" value={form.email} onChange={e => setForm(s => ({ ...s, email: e.target.value }))} style={ctrl} />
          <select value={form.role} onChange={e => setForm(s => ({ ...s, role: e.target.value }))} style={ctrl}>
            <option value="sales">sales</option>
            <option value="senior_sales">senior_sales</option>
            <option value="manager">manager</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={!!form.active} onChange={e => setForm(s => ({ ...s, active: e.target.checked }))} />
            Active
          </label>
          <div>
            <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : (editingId ? 'Update' : 'Create')}</button>
            {editingId ? <button type="button" onClick={resetForm} style={btn}>Cancel</button> : null}
          </div>
        </form>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={ctrl} />
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={ctrl}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {error ? <p style={errorText}>{error}</p> : null}

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Active</th>
                <th style={th}>App User</th>
                <th style={th}>Manager</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => {
                const consultantUserId = r.user_id
                const currentManager = consultantUserId ? memberships[consultantUserId] : ''
                const currentManagerEmail = currentManager ? (userById[currentManager]?.email || `id ${currentManager}`) : ''
                const isAssigning = assignFor === r.id
                return (
                <tr key={r.id}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.email || ''}</td>
                  <td style={td}>{r.role || ''}</td>
                  <td style={td}>{r.active ? 'Yes' : 'No'}</td>
                  <td style={{ ...td, minWidth: 220 }}>
                    {consultantUserId ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={metaText}>#{consultantUserId}</span>
                        <button onClick={() => copyUserIdToClipboard(consultantUserId)} style={btn}>Copy</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={metaText}>Not linked</span>
                        <button onClick={() => autoLinkUser(r)} style={btn}>Auto-link</button>
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, minWidth: 220 }}>
                    {consultantUserId ? (
                      isAssigning && canAssign ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <select value={assignManagerId} onChange={e => setAssignManagerId(e.target.value)} style={ctrl}>
                            <option value="">Select manager…</option>
                            {managerCandidates.map(m => (
                              <option key={m.id} value={m.id}>{m.email} (id {m.id})</option>
                            ))}
                          </select>
                          <button onClick={() => saveAssign(r)} style={btn}>Save</button>
                          <button onClick={() => clearAssign(r)} style={btn}>Clear</button>
                          <button onClick={() => setAssignFor(0)} style={btn}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={metaText}>{currentManager ? `Current: ${currentManagerEmail}` : 'No manager'}</span>
                          {canAssign ? <button onClick={() => openAssign(r)} style={btn}>Change</button> : null}
                        </div>
                      )
                    ) : (
                      <span style={metaText}>No linked user</span>
                    )}
                  </td>
                  <td style={td}>
                    <button onClick={() => edit(r)} style={btn}>Edit</button>
                    <button onClick={() => remove(r.id)} style={btn}>Delete</button>
                  </td>
                </tr>
              )})}
              {list.length === 0 && !loading && (
                <tr>
                  <td style={td} colSpan={7}>No sales people.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={metaText}>
            Page {page} of {totalPages} — {total} total
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={btn}>First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={btn}>Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={btn}>Next</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={btn}>Last</button>
          </div>
        </div>
      </div>
    </div>
  )
}

