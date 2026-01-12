import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function HoldsCEO() {
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
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/holds?status=pending_override_ceo`)
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
  useEffect(() => { load() }, [])

  async function approve(id) {
    try {
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/holds/${id}/override-approve`, { method: 'PATCH' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approve failed')
      notifySuccess('Override approved')
      await load()
    } catch (e) {
      notifyError(e, 'Approve failed')
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  const canCEO = role === 'ceo' || role === 'chairman' || role === 'vice_chairman'

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 lg:ml-0 p-6">
        <div className="w-full mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Hold Override Approvals</h2>
                     <p className="text-sm text-gray-500 mt-1">{canCEO ? 'Review and approve pending hold overrides.' : 'Read-only view of pending overrides.'}</p>
                </div>
                <LoadingButton onClick={load} loading={loading} className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                    Refresh
                </LoadingButton>
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
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Requested By</th>
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
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.requested_by || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.expires_at ? new Date(r.expires_at).toLocaleString() : '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                        {canCEO ? (
                                            <LoadingButton 
                                                onClick={() => approve(r.id)} 
                                                loading={rowLoading[r.id]}
                                                className="inline-flex justify-center items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
                                            >
                                                Approve Override
                                            </LoadingButton>
                                        ) : (
                                            <span className="text-gray-400 italic text-xs">View only</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">No pending requests found.</td></tr>
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
