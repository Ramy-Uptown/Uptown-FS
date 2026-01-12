import React, { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import PromptModal from '../components/PromptModal.jsx'

export default function InventoryDrafts() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(0)
  
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')

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

  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/drafts`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load drafts')
      const list = data.units || []
      setUnits(list)
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const [confirmApproveId, setConfirmApproveId] = useState(0)
  const [promptRejectId, setPromptRejectId] = useState(0)

  async function approve(id) {
    setConfirmApproveId(id)
  }

  async function performApprove(id) {
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/${id}/approve`, { method: 'PATCH' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approve failed')
      setUnits(list => list.filter(u => u.id !== id))
      notifySuccess('Unit approved')
    } catch (e) {
      notifyError(e, 'Approve failed')
    } finally {
      setBusyId(0)
    }
  }

  function reject(id) {
    setPromptRejectId(id)
  }

  async function performReject(id, reason) {
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Reject failed')
      setUnits(list => list.filter(u => u.id !== id))
      notifySuccess('Unit rejected')
    } catch (e) {
      notifyError(e, 'Reject failed')
    } finally {
      setBusyId(0)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={user?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="max-w-9xl mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Inventory Approvals</h2>
                     <p className="text-sm text-gray-500 mt-1">Review and approve draft units for release.</p>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

            <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit Model</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created By</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created At</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading && (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}><td colSpan={7} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                                ))
                            )}
                            {!loading && units.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{u.id}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-mono font-semibold">{u.code}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.model_code ? `${u.model_code} — ${u.model_name || ''}`.trim() : (u.model_name || (u.model_id ? `#${u.model_id}` : '-'))}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.created_by_email || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                            {u.unit_status}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{(u.created_at || '').replace('T', ' ').replace('Z', '')}</td>
                                    <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                        <div className="flex gap-2 justify-end">
                                            <LoadingButton 
                                                disabled={busyId === u.id} 
                                                onClick={() => approve(u.id)} 
                                                loading={busyId === u.id} 
                                                className="inline-flex justify-center items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
                                            >
                                                Approve
                                            </LoadingButton>
                                            <LoadingButton 
                                                disabled={busyId === u.id} 
                                                onClick={() => reject(u.id)} 
                                                loading={busyId === u.id} 
                                                className="inline-flex justify-center items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
                                            >
                                                Reject
                                            </LoadingButton>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && units.length === 0 && (
                                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">No drafts awaiting approval.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-900">
                <span className="material-symbols-outlined text-blue-500">info</span>
                <div>
                     Draft units are created by CRM Admin already linked to a Unit Model with approved standard pricing. Once approved by Top Management, they become <strong>AVAILABLE</strong>.
                </div>
            </div>

        </div>
      </main>

      <ConfirmModal
        open={!!confirmApproveId}
        title="Approve Draft Unit"
        message="Approve this draft unit and mark it AVAILABLE?"
        confirmText="Approve"
        cancelText="Cancel"
        onConfirm={() => { const id = confirmApproveId; setConfirmApproveId(0); performApprove(id) }}
        onCancel={() => setConfirmApproveId(0)}
      />
      <PromptModal
        open={!!promptRejectId}
        title="Reject Draft Unit"
        message="Optionally provide a reason for rejection:"
        placeholder="Reason (optional)"
        confirmText="Reject"
        cancelText="Cancel"
        onSubmit={(val) => { const id = promptRejectId; setPromptRejectId(0); performReject(id, val || '') }}
        onCancel={() => setPromptRejectId(0)}
      />
    </div>
  )
}