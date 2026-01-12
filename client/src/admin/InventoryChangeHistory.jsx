import React, { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError } from '../lib/notifications.js'

function renderPayload(p) {
  try {
    const obj = typeof p === 'string' ? JSON.parse(p) : (p || {})
    const entries = Object.entries(obj)
    if (!entries.length) return '-'
    return (
      <div className="text-xs text-gray-600 space-y-1">
        {entries.map(([k, v]) => (
          <div key={k}><strong className="font-semibold text-gray-700">{k}:</strong> {v == null ? 'null' : String(v)}</div>
        ))}
      </div>
    )
  } catch {
    return <span className="text-xs text-gray-500">{String(p || '-')}</span>
  }
}

export default function InventoryChangeHistory() {
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('all')
  
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')

  async function load() {
    try {
      setLoading(true)
      setError('')
      const q = new URLSearchParams()
      q.set('mine', '1')
      if (status) q.set('status', status)
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/changes?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load my change requests')
      setChanges(data.changes || [])
    } catch (e) {
      setError(e.message || String(e))
      notifyError(e, 'Failed to load my change requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status])

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={user?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="max-w-9xl mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">My Change Requests</h2>
                     <p className="text-sm text-gray-500 mt-1">History of your submitted unit modification requests.</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                 <div className="w-full sm:w-64">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Status</label>
                    <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value)} 
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        <option value="all">All</option>
                        <option value="pending_approval">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                 </div>
                 <div className="flex items-end">
                    <LoadingButton 
                        onClick={load} 
                        loading={loading}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                        Refresh List
                    </LoadingButton>
                 </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

            <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Processed By</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Reason</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Payload</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading && (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan={8} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                                ))
                            )}
                            {!loading && changes.map(ch => (
                                <tr key={ch.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{ch.id}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-mono">{ch.unit_code ? `${ch.unit_code}` : `#${ch.unit_id}`}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                         <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase
                                            ${ch.action === 'delete' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}
                                         `}>
                                            {ch.action}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                                            ${ch.status === 'approved' ? 'bg-green-100 text-green-800' : 
                                              ch.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' : 
                                              'bg-red-100 text-red-800'}`}>
                                            {ch.status.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{(ch.created_at || '').replace('T',' ').replace('Z','')}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{ch.approved_by_email || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 italic max-w-xs">{ch.reason || '-'}</td>
                                    <td className="px-3 py-4 text-sm text-gray-500 max-w-xs">{renderPayload(ch.payload)}</td>
                                </tr>
                            ))}
                            {!loading && changes.length === 0 && (
                                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">No requests found.</td></tr>
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