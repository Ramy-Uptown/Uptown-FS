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
  const [managerSearch, setManagerSearch] = useState('')
  // Quick-assign panel state
  const [qaConsultantSearch, setQaConsultantSearch] = useState('')
  const [qaManagerSearch, setQaManagerSearch] = useState('')
  const [qaConsultantId, setQaConsultantId] = useState('')
  const [qaManagerId, setQaManagerId] = useState('')
  const [qaTeam, setQaTeam] = useState('sales') // 'sales' | 'contracts' | 'finance'

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
        ;(memData.memberships || []).forEach(m => { map[m.member_user_id] = String(m.manager_user_id) })
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

  // Admin helper: populate sales_people from existing users
  async function syncFromUsers() {
    if (!(isSuperAdmin || me?.role === 'admin')) {
      alert('Only Admin or Superadmin can perform this action.')
      return
    }
    try {
      const usersResp = await fetchWithAuth(`${API_URL}/api/auth/users`)
      const usersData = await usersResp.json()
      if (!usersResp.ok) throw new Error(usersData?.error?.message || 'Failed to fetch users')

      const users = usersData.users || []
      const candidates = users.filter(u => u.active && (u.role === 'property_consultant' || u.role === 'sales_manager'))

      if (candidates.length === 0) {
        alert('No active property consultants or sales managers found in Users.')
        return
      }

      const confirmMsg = `Create ${candidates.length} sales_people records from Users?`
      if (!confirm(confirmMsg)) return

      // Create or upsert by email if missing
      let created = 0
      for (const u of candidates) {
        try {
          const payload = {
            user_id: Number(u.id),
            name: String(u.meta?.full_name || '').trim() || u.email,
            email: u.email,
            role: u.role === 'sales_manager' ? 'manager' : 'sales',
            active: true
          }
          const resp = await fetchWithAuth(`${API_URL}/api/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          const data = await resp.json()
          if (resp.ok) {
            created++
          } else {
            // If duplicate email constraint blocks insert, skip
            const msg = data?.error?.message || ''
            if (/duplicate key/i.test(msg) || /unique constraint/i.test(msg)) {
              // ignore
            } else {
              console.warn('Sync failed for', u.email, msg)
            }
          }
        } catch (err) {
          console.warn('Sync error for', u.email, err?.message || err)
        }
      }

      await load()
      alert(`Sync complete. Created ${created} records.`)
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  // Manager assignment handlers
  function openAssign(row) {
    setAssignFor(row.id)
    const currentMgr = row.user_id ? memberships[row.user_id] : ''
    setAssignManagerId(currentMgr || '')
    setManagerSearch('')
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

  // Quick assign (search consultant by email/name and pick manager)
  async function saveQuickAssign() {
    if (!qaConsultantId) return alert('Select a team member')
    if (!qaManagerId) return alert('Select a manager')
    try {
      const cfg = TEAM_CONFIG[qaTeam] || TEAM_CONFIG.sales
      const payload = { manager_user_id: Number(qaManagerId) }
      payload[cfg.memberKey] = Number(qaConsultantId)
      const resp = await fetchWithAuth(`${API_URL}${cfg.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to assign')
      setQaConsultantId('')
      setQaManagerId('')
      setQaConsultantSearch('')
      setQaManagerSearch('')
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
  const filteredManagerCandidates = managerCandidates.filter(m => {
    if (!managerSearch) return true
    const q = managerSearch.toLowerCase()
    return (String(m.email || '').toLowerCase().includes(q) || String(m.meta?.full_name || '').toLowerCase().includes(q) || String(m.id).includes(q))
  })
  // Quick-assign candidate sets
  const TEAM_CONFIG = {
    sales: { consultantRole: 'property_consultant', managerRoles: ['sales_manager'], endpoint: '/api/workflow/sales-teams/assign', memberKey: 'consultant_user_id' },
    contracts: { consultantRole: 'contract_person', managerRoles: ['contract_manager'], endpoint: '/api/workflow/contracts-teams/assign', memberKey: 'member_user_id' },
    finance: { consultantRole: 'financial_admin', managerRoles: ['financial_manager'], endpoint: '/api/workflow/finance-teams/assign', memberKey: 'member_user_id' }
  }
  const cfg = TEAM_CONFIG[qaTeam] || TEAM_CONFIG.sales

  const qaConsultantCandidates = allUsers.filter(u => u.role === cfg.consultantRole)
  const qaFilteredConsultants = qaConsultantCandidates.filter(c => {
    if (!qaConsultantSearch) return true
    const q = qaConsultantSearch.toLowerCase()
    return (String(c.email || '').toLowerCase().includes(q) || String(c.meta?.full_name || '').toLowerCase().includes(q) || String(c.id).includes(q))
  })
  const qaManagerCandidates = allUsers.filter(u => cfg.managerRoles.includes(u.role))
  const qaFilteredManagers = qaManagerCandidates.filter(m => {
    if (!qaManagerSearch) return true
    const q = qaManagerSearch.toLowerCase()
    return (String(m.email || '').toLowerCase().includes(q) || String(m.meta?.full_name || '').toLowerCase().includes(q) || String(m.id).includes(q))
  })

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

        {/* Quick assign panel */}
        <div style={{ border: '1px solid #ead9bd', borderRadius: 10, padding: 12, marginBottom: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>Quick Assign Manager to Team Member</div>
            <div>
              <select value={qaTeam} onChange={e => { setQaTeam(e.target.value); setQaConsultantId(''); setQaManagerId(''); }} style={ctrl}>
                <option value="sales">Sales</option>
                <option value="contracts">Contracts</option>
                <option value="finance">Finance</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input placeholder={`Search ${qaTeam === 'sales' ? 'consultant' : 'member'} by name/email/id…`} value={qaConsultantSearch} onChange={e => setQaConsultantSearch(e.target.value)} style={ctrl} />
              <select value={qaConsultantId} onChange={e => setQaConsultantId(e.target.value)} style={ctrl}>
                <option value="">{qaTeam === 'sales' ? 'Select sales consultant…' : qaTeam === 'contracts' ? 'Select contract person…' : 'Select financial admin…'}</option>
                {qaFilteredConsultants.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.email}{u.meta?.full_name ? ` — ${u.meta.full_name}` : ''} (id {u.id})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input placeholder="Search manager by name/email/id…" value={qaManagerSearch} onChange={e => setQaManagerSearch(e.target.value)} style={ctrl} />
              <select value={qaManagerId} onChange={e => setQaManagerId(e.target.value)} style={ctrl}>
                <option value="">{qaTeam === 'sales' ? 'Select sales manager…' : qaTeam === 'contracts' ? 'Select contract manager…' : 'Select financial manager…'}</option>
                {qaFilteredManagers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.email}{u.meta?.full_name ? ` — ${u.meta.full_name}` : ''} (id {u.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <button type="button" onClick={saveQuickAssign} style={btnPrimary} disabled={!qaConsultantId || !qaManagerId}>Assign</button>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={metaText}>Roles are validated per team to prevent cross-department assignments.</span>
          </div>
        </div>

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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 6, alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              placeholder="Search manager by name/email/id…"
                              value={managerSearch}
                              onChange={e => setManagerSearch(e.target.value)}
                              style={{ ...ctrl, minWidth: 180 }}
                            />
                            <select value={assignManagerId} onChange={e => setAssignManagerId(e.target.value)} style={ctrl}>
                              <option value="">Select manager…</option>
                              {filteredManagerCandidates.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.email}{m.meta?.full_name ? ` — ${m.meta.full_name}` : ''} (id {m.id})
                                </option>
                              ))}
                            </select>
                          </div>
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
                  <td style={td} colSpan={8}>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div>No sales people.</div>
                      {(isSuperAdmin || me?.role === 'admin') ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={metaText}>
                            You can populate the Sales Team from existing app users with roles
                            "property_consultant" and "sales_manager".
                          </span>
                          <button type="button" onClick={syncFromUsers} style={btnPrimary}>
                            Populate from Users
                          </button>
                        </div>
                      ) : (
                        <span style={metaText}>Ask an admin to add sales people.</span>
                      )}
                    </div>
                  </td>
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

