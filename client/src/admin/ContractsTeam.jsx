import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function ContractsTeam() {
  const [memberships, setMemberships] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rowLoading, setRowLoading] = useState({})
  const [assigning, setAssigning] = useState(false)

  // Quick-assign controls
  const [memberSearch, setMemberSearch] = useState('')
  const [managerSearch, setManagerSearch] = useState('')
  const [memberId, setMemberId] = useState('')
  const [managerId, setManagerId] = useState('')

  const [members, setMembers] = useState([])
  const [managers, setManagers] = useState([])

  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const canAssign = me?.role === 'superadmin'

  useEffect(() => {
    load()
    // preload lists
    loadUsers('contract_person', setMembers)
    loadUsers('contract_manager', setManagers)
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/contracts-teams/memberships?active=true`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Unable to load memberships')
      setMemberships(data.memberships || [])
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Unable to load contracts team')
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
    if (!memberId) { notifyError('Please select a member.'); return }
    if (!managerId) { notifyError('Please select a manager.'); return }
    try {
      setAssigning(true)
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/contracts-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_user_id: Number(memberId), manager_user_id: Number(managerId) })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Unable to assign')
      setMemberId(''); setManagerId(''); setMemberSearch(''); setManagerSearch('')
      notifySuccess('Assignment updated successfully.')
      await load()
    } catch (e) {
      notifyError(e, 'Unable to assign')
    } finally {
      setAssigning(false)
    }
  }

  async function clearMembership(mgr, mem) {
    const key = `${mgr}:${mem}`
    try {
      setRowLoading(s => ({ ...s, [key]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/contracts-teams/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_user_id: Number(mgr), member_user_id: Number(mem), active: false })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Unable to clear')
      notifySuccess('Assignment cleared successfully.')
      await load()
    } catch (e) {
      notifyError(e, 'Unable to clear')
    } finally {
      setRowLoading(s => ({ ...s, [key]: false }))
    }
  }

  const filteredMembers = members.filter(u => {
    if (!memberSearch) return true
    const q = memberSearch.toLowerCase()
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
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Contracts Team</h1>
                    <p className="mt-1 text-sm text-gray-500">Associate Contract Persons with Contract Managers.</p>
                </header>

                {canAssign ? (
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                    <h3 className="font-semibold text-gray-800 mb-4">Quick Assign</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Contract Person (Member)</label>
                        <div className="flex gap-2">
                            <input 
                                placeholder="Search..." 
                                value={memberSearch} 
                                onChange={e => setMemberSearch(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                            <select 
                                value={memberId} 
                                onChange={e => setMemberId(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 max-w-[200px]"
                            >
                                <option value="">Select...</option>
                                {filteredMembers.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.email} (id {u.id})
                                </option>
                                ))}
                            </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Contract Manager</label>
                        <div className="flex gap-2">
                            <input 
                                placeholder="Search..." 
                                value={managerSearch} 
                                onChange={e => setManagerSearch(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                            <select 
                                value={managerId} 
                                onChange={e => setManagerId(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 max-w-[200px]"
                            >
                                <option value="">Select...</option>
                                {filteredManagers.map(u => (
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
                          onClick={assign} 
                          loading={assigning} 
                          variant="primary" 
                          disabled={!memberId || !managerId}
                          className="w-full md:w-auto h-[38px]"
                        >
                          Assign
                        </LoadingButton>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">
                      Note: Only active users are listed. Use Admin → Users to activate/deactivate accounts.
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-8 flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-500">info</span>
                    <span className="text-sm text-blue-700">Read-only view. Only Admin and Superadmin can assign members to contract managers.</span>
                  </div>
                )}

                {error && <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mb-6 text-sm">{error}</div>}

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                        <tr>
                            <th className="px-6 py-4">Manager User ID</th>
                            <th className="px-6 py-4">Member User ID</th>
                            <th className="px-6 py-4">Active</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                        {loading && (
                            Array.from({ length: 5 }).map((_, i) => (
                                <SkeletonRow key={i} widths={['lg','lg','sm','sm']} />
                            ))
                        )}
                        {!loading && (memberships || []).map((m, idx) => {
                            const key = `${m.manager_user_id}:${m.member_user_id}`
                            return (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-medium text-gray-900">{m.manager_user_id}</span>
                                {m.manager_email && <span className="text-gray-500 ml-2">({m.manager_email})</span>}
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-medium text-gray-900">{m.member_user_id}</span>
                                {m.member_email && <span className="text-gray-500 ml-2">({m.member_email})</span>}
                              </td>
                              <td className="px-6 py-4">
                                {m.active ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    Yes
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    No
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {m.active && canAssign ? (
                                  <LoadingButton 
                                    onClick={() => clearMembership(m.manager_user_id, m.member_user_id)} 
                                    loading={rowLoading[key]}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                  </LoadingButton>
                                ) : (
                                  !canAssign ? <span className="text-gray-300">-</span> : null
                                )}
                              </td>
                            </tr>
                        )})}
                        {!loading && memberships.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center p-8 text-gray-500">No memberships found.</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                  </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  )
}