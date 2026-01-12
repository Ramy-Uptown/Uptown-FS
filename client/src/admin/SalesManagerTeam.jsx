import React, { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
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
  const canAssign = me?.role === 'superadmin'

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

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={me?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 lg:ml-0 p-6">
        <div className="w-full mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Sales Team</h2>
                     <p className="text-sm text-gray-500 mt-1">Manage Sales Manager and Consultant memberships.</p>
                </div>
            </div>

            {canAssign ? (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Assign Consultant to Manager</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                       <div className="space-y-1 lg:col-span-2">
                           <label className="block text-sm font-medium text-gray-700">Filter Consultant</label>
                           <input placeholder="Search name/email..." value={consultantSearch} onChange={e => setConsultantSearch(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm mb-2" />
                           <select value={consultantId} onChange={e => setConsultantId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm">
                                <option value="">Select sales consultant…</option>
                                {filteredConsultants.map(u => (
                                    <option key={u.id} value={u.id}>
                                    {u.email}{u.meta?.full_name ? ` — ${u.meta.full_name}` : ''} (id {u.id})
                                    </option>
                                ))}
                           </select>
                       </div>
                       
                       <div className="flex items-center justify-center pb-2 text-gray-400">
                          <span className="material-symbols-outlined">arrow_forward</span>
                       </div>

                       <div className="space-y-1 lg:col-span-2">
                           <label className="block text-sm font-medium text-gray-700">Filter Manager</label>
                           <input placeholder="Search name/email..." value={managerSearch} onChange={e => setManagerSearch(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm mb-2" />
                           <select value={managerId} onChange={e => setManagerId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm">
                                <option value="">Select sales manager…</option>
                                {filteredManagers.map(u => (
                                    <option key={u.id} value={u.id}>
                                    {u.email}{u.meta?.full_name ? ` — ${u.meta.full_name}` : ''} (id {u.id})
                                    </option>
                                ))}
                           </select>
                       </div>

                       <div className="lg:col-span-5 flex justify-end">
                           <LoadingButton type="button" onClick={assign} loading={assigning} disabled={!consultantId || !managerId} className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm">
                                Assign Membership
                           </LoadingButton>
                       </div>
                    </div>
                </div>
            ) : (
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 text-yellow-800 text-sm">
                    Read-only view. Only Superadmin can assign consultants to managers.
                </div>
            )}

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

            <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">Manager</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Consultant</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Active</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading && (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i}><td colSpan={4} className="px-3 py-4"><SkeletonRow widths={['lg','lg','sm','sm']} /></td></tr>
                                ))
                            )}
                            {!loading && (memberships || []).map((m, idx) => {
                                const key = `${m.manager_user_id}:${m.consultant_user_id}`
                                return (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">
                                        <div className="font-medium">{m.manager_email}</div>
                                        <div className="text-gray-500 text-xs">ID: {m.manager_user_id}</div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                        <div className="font-medium">{m.consultant_email}</div>
                                        <div className="text-gray-500 text-xs">ID: {m.consultant_user_id}</div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${m.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {m.active ? 'Yes' : 'No'}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                        {m.active && canAssign && (
                                            <LoadingButton 
                                                onClick={() => clearMembership(m.manager_user_id, m.consultant_user_id)} 
                                                loading={rowLoading[key]}
                                                className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md text-xs"
                                            >
                                                Unassign
                                            </LoadingButton>
                                        )}
                                    </td>
                                </tr>
                            )})}
                            {memberships.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="px-3 py-12 text-center text-sm text-gray-500">No team memberships found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
      </main>
    </div>
  )
}