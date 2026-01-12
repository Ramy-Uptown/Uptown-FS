import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function SalesAssignments() {
  const [managerId, setManagerId] = useState('')
  const [consultantId, setConsultantId] = useState('')
  const [active, setActive] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')

  // We do not have a list assignments endpoint on this page, it focuses on assign/unassign actions
  // But we could potentially fetch current assignments if needed. For now, matching existing functionality.
  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/sales?role=property_consultant&page=1&pageSize=100`)
      await resp.json()
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Unable to load metadata.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function assign() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(managerId),
          consultant_user_id: Number(consultantId)
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Assign failed')
      notifySuccess('Assignment updated successfully.')
    } catch (e) {
      notifyError(e, 'Unable to assign.')
    } finally {
      setLoading(false)
    }
  }

  async function updateActive() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/sales-teams/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_user_id: Number(managerId),
          consultant_user_id: Number(consultantId),
          active: !!active
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Update failed')
      notifySuccess('Assignment updated successfully.')
    } catch (e) {
      notifyError(e, 'Unable to update assignment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={user?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="w-full mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Sales Team Assignments</h2>
                     <p className="text-sm text-gray-500 mt-1">Manually assign Consultants to Manager teams.</p>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Manager User ID</label>
                        <input 
                            placeholder="e.g. 101" 
                            value={managerId} 
                            onChange={e => setManagerId(e.target.value)} 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Consultant User ID</label>
                        <input 
                            placeholder="e.g. 202" 
                            value={consultantId} 
                            onChange={e => setConsultantId(e.target.value)} 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        />
                     </div>

                     <div className="md:col-span-2">
                         <label className="flex items-center gap-2">
                             <input 
                                type="checkbox" 
                                checked={active} 
                                onChange={e => setActive(e.target.checked)} 
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                             <span className="text-sm text-gray-700">Active Membership</span>
                         </label>
                         <p className="text-xs text-gray-500 mt-1 ml-6">Uncheck to deactivate an existing assignment.</p>
                     </div>
                </div>

                <div className="mt-6 flex gap-4 border-t border-gray-100 pt-4">
                     <LoadingButton 
                        onClick={assign} 
                        loading={loading}
                        className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
                    >
                        Create Assignment
                     </LoadingButton>
                     <LoadingButton 
                        onClick={updateActive} 
                        loading={loading}
                        className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
                    >
                        Update Status
                     </LoadingButton>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-900">
                <span className="material-symbols-outlined text-blue-500">info</span>
                <div>
                    <strong>Tip:</strong> Use the <a href="/admin/users" className="underline hover:text-blue-700">Users Page</a> or <a href="/admin/sales-teams" className="underline hover:text-blue-700">Sales Teams Page</a> to find User IDs. This tool is for manual overrides or fixes.
                </div>
            </div>

        </div>
      </main>
    </div>
  )
}
