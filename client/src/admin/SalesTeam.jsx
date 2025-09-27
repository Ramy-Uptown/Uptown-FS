import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, ctrl, btn, btnPrimary, tableWrap, table, pageContainer, pageTitle, errorText, metaText } from '../lib/ui.js'
import BrandHeader from '../lib/BrandHeader.jsx'

/**
 * SalesTeam — Manager assignment page
 * This page is ONLY for assigning Sales Managers to Property Consultants.
 * It does NOT create employees or write to sales_people.
 * Data sources:
 *  - Users list (to get consultants and managers)
 *  - Sales team memberships (manager_user_id <-> consultant_user_id)
 */
export default function SalesTeam() {
  const [consultants, setConsultants] = useState([]) // property_consultant users
  const [managers, setManagers] = useState([]) // sales_manager users
  const [memberships, setMemberships] = useState({}) // { consultant_user_id: manager_user_id }
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // assignment UI
  const [assignFor, setAssignFor] = useState(0) // consultant user id
  const [assignManagerId, setAssignManagerId] = useState('')
  const [managerSearch, setManagerSearch] = useState('')

  // quick-assign
  const [qaConsultantSearch, setQaConsultantSearch] = useState('')
  const [qaConsultantId, setQaConsultantId] = useState('')
  const [qaManagerSearch, setQaManagerSearch] = useState('')
  const [qaManagerId, setQaManagerId] = useState('')

  // current user
  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const isSuperAdmin = me?.role === 'superadmin'
  const canAssign = isSuperAdmin || me?.role === 'admin' || me?.role === 'sales_manager'

  async function load() {
    try {
      setLoading(true)
      setError('')
      const [usersResp, memResp] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/auth/users`),
        fetchWithAuth(`${API_URL}/api/workflow/sales-teams/memberships?active=true`)
      ])
      const usersData = await usersResp.json()
      if (!usersResp.ok) throw new Error(usersData?.error?.message || 'Failed to load users')

      const allUsers = usersData.users || []
      setConsultants(allUsers.filter(u => u.role === 'property_consultant'))
      setManagers(allUsers.filter(u => u.role === 'sales_manager'))

      const memData = await memResp.json()
      if (!memResp.ok) throw new Error(memData?.error?.message || 'Failed to load memberships')
      const map = {}
      ;(memData.memberships || []).forEach(m => {
        map[m.member_user_id] = String(m.manager_user_id)
      })
      setMemberships(map)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // derived
  const filteredConsultants = consultants.filter(c => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      String(c.email || '').toLowerCase().includes(q) ||
      String(c.meta?.full_name || '').toLowerCase().includes(q) ||
      String(c.id).includes(q)
    )
  })
  const total = filteredConsultants.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageRows = filteredConsultants.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

  const filteredManagers = managers.filter(m => {
    const q = managerSearch.trim().toLowerCase()
    if (!q) return true
    return (
      String(m.email || '').toLowerCase().includes(q) ||
      String(m.meta?.full_name || '').toLowerCase().includes(q) ||
      String(m.id).includes(q)
    )
  })

  // Quick assign
  const qaFilteredConsultants = consultants.filter(c => {
    const q = qaConsultantSearch.trim().toLowerCase()
    if (!q) return true
    return (
      String(c.email || '').toLowerCase().includes(q) ||
      String(c.meta?.full_name || '').toLowerCase().includes(q) ||
      String(c.id).includes(q)
    )
  })
  const qaFilteredManagers = managers.filter(m => {
    const q = qaManagerSearch.trim().toLowerCase()
    if (!q) return true
    return (
      String(m.email || '').toLowerCase().includes(q) ||
      String(m.meta?.full_name || '').toLowerCase().includes(q) ||
      String(m.id).includes(q)
    )
  })

  function openAssign(consultantUserId) {
    setAssignFor(consultantUserId)
    setAssignManagerId(memberships[consultantUserId] || '')
    setManagerSearch('')
  }

  async function saveAssign(consultantUserId) {
    if (!assignManagerId) return alert('Select a manager')
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(assignManagerId),
          consultant_user_id: Number(consultantUserId)
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to assign')
      setAssignFor(0)
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  async function clearAssign(consultantUserId) {
    const currentMgr = memberships[consultantUserId]
    if (!currentMgr) { setAssignFor(0); return }
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(currentMgr),
          consultant_user_id: Number(consultantUserId),
          active: false
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to clear')
      setAssignFor(0)
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  async function saveQuickAssign() {
    if (!qaConsultantId) return alert('Select a consultant')
    if (!qaManagerId) return alert('Select a manager')
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(qaManagerId),
          consultant_user_id: Number(qaConsultantId)
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to assign')
      setQaConsultantId(''); setQaManagerId('')
      setQaConsultantSearch(''); setQaManagerSearch('')
      await load()
    } catch (e) {
      alert(e.message || String(e))
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
      <div style={pageContainer}>
        <h2 style={pageTitle}>Sales Team — Manager Assignment</h2>

        {/* Quick assign panel */}
        <div style={{ border: '1px solid #ead9bd', borderRadius: 10, padding: 12, marginBottom: 12, background: '#fff' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Quick Assign Sales Manager to Property Consultant</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input placeholder="Search consultant by name/email/id…" value={qaConsultantSearch} onChange={e => setQaConsultantSearch(e.target.value)} style={ctrl} />
              <select value={qaConsultantId} onChange={e => setQaConsultantId(e.target.value)} style={ctrl}>
                <option value="">Select property consultant…</option>
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
                <option value="">Select sales manager…</option>
                {qaFilteredManagers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.email}{u.meta?.full_name ? ` — ${u.meta.full_name}` : ''} (id {u.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <button type="button" onClick={saveQuickAssign} style={btnPrimary} disabled={!qaConsultantId || !qaManagerId || !canAssign}>Assign</button>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={metaText}>This page assigns managers only. Employees are managed in Admin → Users.</span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input placeholder="Search consultants…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={ctrl} />
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={ctrl}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {error ? <p style={errorText}>{error}</p> : null}

        {/* Table of consultants with current manager */}
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Consultant ID</th>
                <th style={th}>Email</th>
                <th style={th}>Name</th>
                <th style={th}>Current Manager</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(c => {
                const mgrId = memberships[c.id] || ''
                const mgr = managers.find(m => m.id === Number(mgrId))
                const isAssigning = assignFor === c.id
                return (
                  <tr key={c.id}>
                    <td style={td}>{c.id}</td>
                    <td style={td}>{c.email}</td>
                    <td style={td}>{c.meta?.full_name || ''}</td>
                    <td style={{ ...td, minWidth: 220 }}>
                      {isAssigning && canAssign ? (
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
                              {filteredManagers.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.email}{m.meta?.full_name ? ` — ${m.meta.full_name}` : ''} (id {m.id})
                                </option>
                              ))}
                            </select>
                          </div>
                          <button onClick={() => saveAssign(c.id)} style={btn}>Save</button>
                          <button onClick={() => clearAssign(c.id)} style={btn} disabled={!mgrId}>Clear</button>
                          <button onClick={() => setAssignFor(0)} style={btn}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={metaText}>{mgr ? `${mgr.email}${mgr.meta?.full_name ? ` — ${mgr.meta.full_name}` : ''}` : 'No manager'}</span>
                          {canAssign ? <button onClick={() => openAssign(c.id)} style={btn}>Change</button> : null}
                        </div>
                      )}
                    </td>
                    <td style={td}>
                      {canAssign ? <button onClick={() => openAssign(c.id)} style={btn}>Assign</button> : <span style={metaText}>No actions</span>}
                    </td>
                  </tr>
                )
              })}
              {pageRows.length === 0 && !loading && (
                <tr>
                  <td style={td} colSpan={5}>No consultants found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={metaText}>
            Page {page} of {totalPages} — {total} consultants
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
}>
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

