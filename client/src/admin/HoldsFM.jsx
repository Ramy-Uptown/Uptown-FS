import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function HoldsFM() {
  const [status, setStatus] = useState('approved')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')
  const [rowLoading, setRowLoading] = useState({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth_user')
      if (raw) {
        const u = JSON.parse(raw)
        setRole(u?.role || '')
      }
    } catch {}
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError('')
      const q = status ? `?status=${encodeURIComponent(status)}` : ''
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/holds${q}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load holds')
      setRows(data.holds || [])
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load holds')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status])

  async function act(path, method = 'PATCH', id) {
    try {
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}${path}`, { method })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Action failed')
      notifySuccess('Action completed')
      await load()
    } catch (e) {
      notifyError(e, 'Action failed')
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  const canFM = role === 'financial_manager'

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="max-w-7xl mx-auto space-y-6">

             <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Manage Holds</h2>
                     <p className="text-sm text-gray-500 mt-1">{canFM ? 'Approve, extend, and manage unit blocks.' : 'Unit hold status overview.'}</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                 <div className="w-full md:w-64">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Filter Status</label>
                    <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value)} 
                        disabled={loading}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        <option value="">All</option>
                        <option value="pending_approval">Pending Approval</option>
                        <option value="approved">Approved (Active Block)</option>
                        <option value="pending_override_ceo">Pending CEO Override Approval</option>
                        <option value="override_ceo_approved">CEO Approved Override</option>
                        <option value="unblocked">Unblocked</option>
                        <option value="expired">Expired</option>
                        <option value="reserved">Reserved</option>
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
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit ID</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Proposed Plan</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Current Expiry</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading && (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan={6} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                                ))
                            )}
                            {!loading && rows.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{r.id}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.unit_id}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.payment_plan_id || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                                            ${r.status.includes('approved') ? 'bg-green-100 text-green-800' : 
                                              r.status.includes('pending') ? 'bg-yellow-100 text-yellow-800' : 
                                              r.status === 'expired' ? 'bg-red-100 text-red-800' :
                                              'bg-gray-100 text-gray-800'}`}>
                                            {r.status.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.expires_at ? new Date(r.expires_at).toLocaleString() : '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium relative pr-4 sm:pr-6">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {canFM && r.status === 'pending_approval' && (
                                                <LoadingButton 
                                                    onClick={() => act(`/api/inventory/holds/${r.id}/approve`, 'PATCH', r.id)} 
                                                    loading={rowLoading[r.id]}
                                                    className="text-green-600 hover:text-green-900 bg-green-50 px-2 py-1 rounded border border-green-200"
                                                >
                                                    Approve
                                                </LoadingButton>
                                            )}
                                            {canFM && r.status === 'approved' && (
                                                <>
                                                    <LoadingButton 
                                                        onClick={() => act(`/api/inventory/holds/${r.id}/unblock`, 'PATCH', r.id)} 
                                                        loading={rowLoading[r.id]}
                                                        className="text-gray-600 hover:text-gray-900 bg-gray-50 px-2 py-1 rounded border border-gray-200"
                                                    >
                                                        Unblock
                                                    </LoadingButton>
                                                    <LoadingButton 
                                                        onClick={() => act(`/api/inventory/holds/${r.id}/extend`, 'PATCH', r.id)} 
                                                        loading={rowLoading[r.id]}
                                                        className="text-blue-600 hover:text-blue-900 bg-blue-50 px-2 py-1 rounded border border-blue-200"
                                                    >
                                                        +7 Days
                                                    </LoadingButton>
                                                    <LoadingButton 
                                                        onClick={() => act(`/api/inventory/holds/${r.id}/override-request`, 'POST', r.id)} 
                                                        loading={rowLoading[r.id]}
                                                        className="text-purple-600 hover:text-purple-900 bg-purple-50 px-2 py-1 rounded border border-purple-200"
                                                    >
                                                        Req. Override
                                                    </LoadingButton>
                                                </>
                                            )}
                                            {canFM && r.status === 'override_ceo_approved' && (
                                                <LoadingButton 
                                                    onClick={() => act(`/api/inventory/holds/${r.id}/override-unblock`, 'PATCH', r.id)} 
                                                    loading={rowLoading[r.id]}
                                                    className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-2 py-1 rounded border border-indigo-200"
                                                >
                                                    Override Unblock
                                                </LoadingButton>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">No holds found matching this status.</td></tr>
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
