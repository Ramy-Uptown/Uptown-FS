import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import LoadingButton from '../components/LoadingButton.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import SkeletonRow from '../components/SkeletonRow.jsx'

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
    if (!assignManagerId) { notifyError('Please select a manager.'); return }
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
      if (!resp.ok) throw new Error(data?.error?.message || 'Unable to assign manager')
      setCurrentManagerId(assignManagerId)
      notifySuccess('Manager assigned successfully.')
    } catch (e) {
      notifyError(e, 'Unable to assign manager')
    } finally {
      setBusy(false)
    }
  }

  async function clearManager() {
    if (!currentManagerId) { notifyError('No current manager to clear.'); return }
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
      if (!resp.ok) throw new Error(data?.error?.message || 'Unable to clear manager')
      setCurrentManagerId('')
      setAssignManagerId('')
      notifySuccess('Manager assignment cleared successfully.')
    } catch (e) {
      notifyError(e, 'Unable to clear manager')
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar role={me?.role} />
         <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
            <div className="w-full mx-auto">
               <h2 className="text-3xl font-display font-bold text-gray-900 mb-6">Edit User</h2>
               {error ? <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div> : <div className="text-gray-500">Loading user data...</div>}
            </div>
         </main>
      </div>
    )
  }

  const isSelf = me.id === user.id

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={me?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 lg:ml-0 p-6">
        <div className="w-full mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Edit User #{user.id}</h2>
                     <p className="text-sm text-gray-500 mt-1">Update user details, role, and settings.</p>
                </div>
                <button type="button" onClick={() => navigate('/admin/users')} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm">
                   Back to Users
                </button>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

            <div className="bg-white px-6 py-6 rounded-lg shadow-sm border border-gray-100">
                <form onSubmit={saveBasics} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-50 disabled:text-gray-500" required disabled={!isSuperAdmin} />
                        {!isSuperAdmin && <p className="mt-1 text-xs text-gray-500">Only Superadmin can edit email.</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                           <select value={role} onChange={e => setRole(e.target.value)} disabled={isSelf || !isSuperAdmin} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-50 disabled:text-gray-500">
                                {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                           </select>
                        </div>
                        <div className="flex items-end pb-3">
                           <label className="inline-flex items-center">
                              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={isSelf} className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
                              <span className="ml-2 text-sm text-gray-700">Active Account</span>
                           </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-50 disabled:text-gray-500" disabled={!isSuperAdmin} placeholder="Employee full name" />
                        {!isSuperAdmin && <p className="mt-1 text-xs text-gray-500">Only Superadmin can edit name.</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" placeholder="Internal notes..." />
                    </div>

                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Metadata (JSON)</label>
                         <textarea value={metaTextState} onChange={e => setMetaTextState(e.target.value)} rows={6} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm font-mono bg-slate-50" placeholder='{"key":"value"}' />
                         {!isSuperAdmin && <p className="mt-1 text-xs text-gray-500">Note: Name is managed separately and cannot be changed by Admin.</p>}
                    </div>
                    
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
                         <LoadingButton type="submit" loading={busy} className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm">
                            Save basic info
                         </LoadingButton>
                         <LoadingButton type="button" onClick={saveRole} disabled={busy || isSelf || !isSuperAdmin} className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm disabled:opacity-50">
                            Save role
                         </LoadingButton>
                         <LoadingButton type="button" onClick={saveActive} disabled={busy || isSelf} className={`inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm disabled:opacity-50 ${active ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}>
                            {active ? 'Deactivate' : 'Activate'}
                         </LoadingButton>
                    </div>
                </form>
            </div>

            {canAssignManager && (
              <div className="bg-white px-6 py-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Manager Assignment</h3>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assign Manager</label>
                      <select value={assignManagerId} onChange={e => setAssignManagerId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm">
                        <option value="">Select manager…</option>
                        {managers.map(m => <option key={m.id} value={m.id}>{m.email} (id {m.id})</option>)}
                      </select>
                  </div>
                  <LoadingButton type="button" onClick={assignManager} disabled={busy || !assignManagerId} className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm">
                    Assign
                  </LoadingButton>
                  {currentManagerId ? (
                      <LoadingButton type="button" onClick={clearManager} disabled={busy} className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm">
                        Clear
                      </LoadingButton>
                   ) : null}
                </div>
                <p className="mt-2 text-sm text-gray-500">{currentManagerId ? `Current Manager: ${currentManagerEmail}` : 'No manager assigned'}</p>
              </div>
            )}

            <div className="bg-white px-6 py-6 rounded-lg shadow-sm border border-gray-100">
                <form onSubmit={savePassword} className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Set Password</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input type="password" placeholder="New password" value={pw1} onChange={e => setPw1(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                      <input type="password" placeholder="Confirm new password" value={pw2} onChange={e => setPw2(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                       <p className="text-xs text-gray-500">Note: Updating a password invalidates existing sessions.</p>
                       <LoadingButton type="submit" disabled={busy} className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm">
                         Update Password
                       </LoadingButton>
                  </div>
                </form>
            </div>

            <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                     <h3 className="text-lg font-medium text-gray-900">Audit History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">When</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">By (user id)</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {audit.map((a, i) => (
                                <tr key={a.id || i} className="hover:bg-gray-50">
                                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm text-gray-500">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">{a.action}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{a.changed_by}</td>
                                    <td className="px-3 py-4 text-xs font-mono text-gray-500 break-all">
                                        {a.details ? JSON.stringify(a.details) : ''}
                                    </td>
                                </tr>
                            ))}
                            {audit.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">No audit items found.</td>
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