import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

/**
 * SalesTeam — Manager assignment page
 * This page is ONLY for assigning Sales Managers to Property Consultants.
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
  const canAssign = isSuperAdmin

  async function load() {
    try {
      setLoading(true)
      setError('')
      const [usersResp, memResp] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/auth/users`),
        fetchWithAuth(`${API_URL}/api/workflow/sales-teams/memberships?active=true`)
      ])
      const usersData = await usersResp.json()
      if (!usersResp.ok) throw new Error(usersData?.error?.message || 'Unable to load users')

      const allUsers = usersData.users || []
      setConsultants(allUsers.filter(u => u.role === 'property_consultant'))
      setManagers(allUsers.filter(u => u.role === 'sales_manager'))

      const memData = await memResp.json()
      if (!memResp.ok) throw new Error(memData?.error?.message || 'Unable to load memberships')
      const map = {}
      ;(memData.memberships || []).forEach(m => {
        map[m.member_user_id] = String(m.manager_user_id)
      })
      setMemberships(map)
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Unable to load team data')
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

  const [rowLoading, setRowLoading] = useState({})
  async function saveAssign(consultantUserId) {
    if (!assignManagerId) { notifyError('Please select a manager.'); return }
    const key = `assign:${consultantUserId}`
    try {
      setRowLoading(s => ({ ...s, [key]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(assignManagerId),
          consultant_user_id: Number(consultantUserId)
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Unable to assign manager')
      setAssignFor(0)
      notifySuccess('Assignment updated successfully.')
      await load()
    } catch (e) {
      notifyError(e, 'Unable to assign manager')
    } finally {
      setRowLoading(s => ({ ...s, [key]: false }))
    }
  }

  async function clearAssign(consultantUserId) {
    const currentMgr = memberships[consultantUserId]
    if (!currentMgr) { setAssignFor(0); return }
    const key = `clear:${consultantUserId}`
    try {
      setRowLoading(s => ({ ...s, [key]: true }))
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
      notifySuccess('Assignment cleared')
      await load()
    } catch (e) {
      notifyError(e, 'Failed to clear')
    } finally {
      setRowLoading(s => ({ ...s, [key]: false }))
    }
  }

  const [quickAssigning, setQuickAssigning] = useState(false)
  async function saveQuickAssign() {
    if (!qaConsultantId) { notifyError('Select a consultant'); return }
    if (!qaManagerId) { notifyError('Select a manager'); return }
    try {
      setQuickAssigning(true)
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
      notifySuccess('Manager assigned')
      await load()
    } catch (e) {
      notifyError(e, 'Failed to assign')
    } finally {
      setQuickAssigning(false)
    }
  }

  const handleLogout = async () => {
    window.location.href = '/login'
  }

  return (
    <div className="flex h-screen w-full bg-background-light font-sans overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light relative">
        <div className="lg:hidden bg-[#1F2124] text-white p-4 flex justify-between items-center shadow-md">
           <span className="font-light tracking-widest uppercase">Uptown</span>
           <button className="text-white" onClick={handleLogout}><span className="material-symbols-outlined">logout</span></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full mx-auto">
                <header className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Sales Team</h1>
                    <p className="mt-1 text-sm text-gray-500">Assign Sales Managers to Property Consultants.</p>
                </header>

                {/* Quick assign panel */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                  <h3 className="font-semibold text-gray-800 mb-4">Quick Assign</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Property Consultant</label>
                        <div className="flex gap-2">
                            <input 
                                placeholder="Search..." 
                                value={qaConsultantSearch} 
                                onChange={e => setQaConsultantSearch(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                            <select 
                                value={qaConsultantId} 
                                onChange={e => setQaConsultantId(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 max-w-[200px]"
                            >
                                <option value="">Select...</option>
                                {qaFilteredConsultants.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.email} (id {u.id})
                                </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Sales Manager</label>
                        <div className="flex gap-2">
                            <input 
                                placeholder="Search..." 
                                value={qaManagerSearch} 
                                onChange={e => setQaManagerSearch(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                            <select 
                                value={qaManagerId} 
                                onChange={e => setQaManagerId(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 max-w-[200px]"
                            >
                                <option value="">Select...</option>
                                {qaFilteredManagers.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.email} (id {u.id})
                                </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex">
                      <LoadingButton 
                        type="button" 
                        onClick={saveQuickAssign} 
                        loading={quickAssigning} 
                        variant="primary" 
                        disabled={!qaConsultantId || !qaManagerId || !canAssign}
                        className="w-full md:w-auto h-[38px]"
                      >
                        Assign
                      </LoadingButton>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">
                    Note: This page manages hierarchical assignments only. Employees are managed in the Users section.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between gap-4 mb-6 bg-white p-2 rounded-lg border border-gray-200 shadow-sm w-fit">
                  <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px]">search</span>
                      <input 
                        placeholder="Search list..." 
                        value={search} 
                        onChange={e => { setSearch(e.target.value); setPage(1) }} 
                        className="pl-9 pr-4 py-1.5 border-none focus:ring-0 text-sm w-64"
                      />
                  </div>
                  <div className="h-6 w-px bg-gray-200"></div>
                  <select 
                    value={pageSize} 
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} 
                    className="border-none py-1.5 text-sm focus:ring-0 text-gray-600 cursor-pointer bg-transparent pr-8"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>

                {error && <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mb-6 text-sm">{error}</div>}

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Consultant</th>
                            <th className="px-6 py-4">Current Manager</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                        {loading && (
                            Array.from({ length: 5 }).map((_, i) => (
                                <SkeletonRow key={i} widths={['sm','lg','lg','sm']} />
                            ))
                        )}
                        {!loading && pageRows.map(c => {
                            const mgrId = memberships[c.id] || ''
                            const mgr = managers.find(m => m.id === Number(mgrId))
                            const isAssigning = assignFor === c.id
                            const keyAssign = `assign:${c.id}`
                            const keyClear = `clear:${c.id}`
                            return (
                            <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 text-gray-500 w-20">#{c.id}</td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{c.email}</div>
                                    {c.meta?.full_name && <div className="text-xs text-gray-500">{c.meta.full_name}</div>}
                                </td>
                                <td className="px-6 py-4">
                                {isAssigning && canAssign ? (
                                    <div className="flex items-center gap-2">
                                        <select 
                                            value={assignManagerId} 
                                            onChange={e => setAssignManagerId(e.target.value)} 
                                            className="px-2 py-1 text-sm border rounded bg-white max-w-[200px]"
                                        >
                                            <option value="">Select manager...</option>
                                            {filteredManagers.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.email} {m.meta?.full_name ? `(${m.meta.full_name})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <LoadingButton onClick={() => saveAssign(c.id)} loading={rowLoading[keyAssign]} className="text-xs bg-primary text-white px-2 py-1 rounded">Save</LoadingButton>
                                        <LoadingButton onClick={() => setAssignFor(0)} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Cancel</LoadingButton>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {mgr ? (
                                            <div className="flex items-center gap-2">
                                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-medium">
                                                    {mgr.email}
                                                </span>
                                                {canAssign && (
                                                    <button onClick={() => openAssign(c.id)} className="text-gray-400 hover:text-primary transition-colors">
                                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic text-xs">Unassigned</span>
                                        )}
                                    </div>
                                )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                {canAssign ? (
                                    isAssigning ? null : (
                                       <div className="flex justify-end gap-2">
                                           {!mgr ? (
                                                <button onClick={() => openAssign(c.id)} className="text-primary hover:text-primary-hover text-sm font-medium">
                                                    Assign
                                                </button>
                                           ) : (
                                                <LoadingButton 
                                                    onClick={() => clearMembership(mgrId, c.id)} 
                                                    loading={rowLoading[keyClear]}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                                </LoadingButton>
                                           )}
                                       </div>
                                    )
                                ) : <span className="text-gray-300">-</span>}
                                </td>
                            </tr>
                            )
                        })}
                        {pageRows.length === 0 && !loading && (
                            <tr>
                                <td colSpan={4} className="text-center p-8 text-gray-500">No consultants found.</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6">
                    <span className="text-sm text-gray-500">
                        Page <span className="font-medium text-gray-900">{page}</span> of <span className="font-medium text-gray-900">{totalPages}</span>
                    </span>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={page === 1 || loading}
                            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                        >
                            Previous
                        </button>
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                            disabled={page === totalPages || loading}
                            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  )
}