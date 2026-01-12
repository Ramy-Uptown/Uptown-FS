import React, { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

function yesNo(v, area) {
  if (v != null) return v ? 'Yes' : 'No'
  const a = Number(area)
  return Number.isFinite(a) && a > 0 ? 'Yes' : 'No'
}

export default function UnitModelChanges() {
  const [changes, setChanges] = useState([])
  const [status, setStatus] = useState('pending_approval')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rejectReason, setRejectReason] = useState({})
  const [rowLoading, setRowLoading] = useState({})
  const [editPayload, setEditPayload] = useState({}) // JSON text editor for rejected rows
  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const role = me?.role
  const isTop = role === 'ceo' || role === 'chairman' || role === 'vice_chairman'
  const isFM = role === 'financial_manager'

  async function load() {
    try {
      setLoading(true); setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes?status=${encodeURIComponent(status)}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load changes')
      setChanges(data.changes || [])
      // Initialize editors for rejected rows
      if (status === 'rejected') {
        const init = {}
        for (const ch of (data.changes || [])) {
          init[ch.id] = JSON.stringify(ch.payload || {}, null, 2)
        }
        setEditPayload(init)
      }
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load changes')
    } finally {
      setLoading(false)
    }
  }

  // Initialize status from URL (?status=rejected|pending_approval|approved)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const s = params.get('status')
      if (s && ['pending_approval', 'approved', 'rejected'].includes(s)) {
        setStatus(s)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [status])

  async function approveChange(id) {
    if (!isTop) { notifyError('Only Top Management can approve.'); return }
    try {
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}/approve`, { method: 'PATCH' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approve failed')
      notifySuccess('Change approved')
      await load()
    } catch (e) {
      notifyError(e, 'Approve failed')
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  async function rejectChange(id) {
    if (!isTop) { notifyError('Only Top Management can reject.'); return }
    const reason = (rejectReason[id] || '').trim()
    if (!reason) { notifyError('Please provide a reason for rejection'); return }
    try {
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Reject failed')
      setRejectReason(s => ({ ...s, [id]: '' }))
      notifySuccess('Change rejected')
      await load()
    } catch (e) {
      notifyError(e, 'Reject failed')
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  async function cancelChange(id, requestedBy) {
    if (!isFM) return
    if (requestedBy !== me?.id) { notifyError('You can only cancel your own requests.'); return }
    if (!window.confirm('Cancel this pending request? This cannot be undone.')) return
    try {
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Cancel failed')
      notifySuccess('Request cancelled')
      await load()
    } catch (e) {
      notifyError(e, 'Cancel failed')
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  async function deleteRejected(id, requestedBy) {
    if (!isFM) return
    if (requestedBy !== me?.id) { notifyError('You can only delete your own requests.'); return }
    if (!window.confirm('Delete this rejected request? This cannot be undone.')) return
    try {
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Delete failed')
      notifySuccess('Rejected request deleted')
      await load()
    } catch (e) {
      notifyError(e, 'Delete failed')
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  async function modifyRejected(id, action, requestedBy) {
    if (!isFM) return
    if (requestedBy !== me?.id) { notifyError('You can only modify your own requests.'); return }
    let body = {}
    if (action !== 'delete') {
      const text = editPayload[id] || ''
      let parsed = null
      try {
        parsed = text.trim() ? JSON.parse(text) : {}
      } catch (e) {
        notifyError('Payload must be valid JSON.')
        return
      }
      if (!parsed || typeof parsed !== 'object') {
        notifyError('Payload must be a JSON object.')
        return
      }
      body.payload = parsed
    }
    try {
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}/modify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Modify failed')
      notifySuccess('Request updated and resubmitted for approval')
      await load()
      setStatus('pending_approval')
    } catch (e) {
      notifyError(e, 'Modify failed')
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="w-full mx-auto space-y-6">
            
            <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Unit Model Changes</h2>
                     <p className="text-sm text-gray-500 mt-1">Audit log and approval queue for unit model modifications.</p>
                </div>
                <div className="w-64">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Filter Status</label>
                    <select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        <option value="pending_approval">Pending Approval</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {error && (
                 <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                         <span className="material-symbols-outlined text-red-400 mr-2">error</span>
                         <div className="text-sm text-red-700">{error}</div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Model ID</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Requested By</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Approved By</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Reason</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created At</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Updated At</th>
                          {/* Payload summary */}
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Model Name</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Area (m²)</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Orient.</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garden</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">G. Area</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Roof</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">R. Area</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Garage</th>
                          {((status === 'pending_approval' && (isTop || isFM)) || (status === 'rejected' && isFM)) && (
                            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {loading && (
                           Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                                <td colSpan={18} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td>
                            </tr>
                           ))
                        )}
                        {!loading && changes.map(ch => {
                             const p = ch.payload || {}
                             const canCancel = status === 'pending_approval' && isFM && (ch.requested_by === me?.id)
                             const canEditRejected = status === 'rejected' && isFM && (ch.requested_by === me?.id)
                            return (
                                <tr key={ch.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{ch.id}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-bold uppercase text-xs tracking-wide">{ch.action}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{ch.model_id || '—'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-xs">{ch.requested_by_email || ch.requested_by}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-xs">{ch.approved_by_email || (ch.approved_by || '—')}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-xs max-w-[150px] truncate" title={ch.reason || ''}>{ch.reason || '—'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-xs">{ch.created_at ? new Date(ch.created_at).toLocaleString() : ''}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-xs">{ch.updated_at ? new Date(ch.updated_at).toLocaleString() : ''}</td>
                                    
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">{p.model_name || '—'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{p.model_code || '—'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{p.area != null ? Number(p.area).toLocaleString() : '—'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">{String(p.orientation || '').replace(/_/g, ' ') || '—'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{yesNo(p.has_garden, p.garden_area)}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{p.garden_area != null ? Number(p.garden_area).toLocaleString() : '—'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{yesNo(p.has_roof, p.roof_area)}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{p.roof_area != null ? Number(p.roof_area).toLocaleString() : '—'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{p.garage_area != null ? Number(p.garage_area).toLocaleString() : '—'}</td>

                                    {((status === 'pending_approval' && (isTop || canCancel)) || canEditRejected) && (
                                        <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <div className="flex flex-col gap-2 items-end">
                                                {isTop && status === 'pending_approval' ? (
                                                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200 shadow-sm">
                                                    <LoadingButton
                                                        onClick={() => approveChange(ch.id)}
                                                        loading={rowLoading[ch.id]}
                                                        className="inline-flex justify-center items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                                    >
                                                        Approve
                                                    </LoadingButton>
                                                    <input
                                                        placeholder="Reason..."
                                                        value={rejectReason[ch.id] || ''}
                                                        onChange={e => setRejectReason(s => ({ ...s, [ch.id]: e.target.value }))}
                                                        className="block w-24 px-2 py-1 text-xs rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                                                    />
                                                    <LoadingButton
                                                        onClick={() => rejectChange(ch.id)}
                                                        loading={rowLoading[ch.id]}
                                                        disabled={!rejectReason[ch.id]}
                                                        className="inline-flex justify-center items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                                                    >
                                                        Reject
                                                    </LoadingButton>
                                                </div>
                                                ) : null}

                                                {canCancel && status === 'pending_approval' ? (
                                                <LoadingButton
                                                    onClick={() => cancelChange(ch.id, ch.requested_by)}
                                                    loading={rowLoading[ch.id]}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Cancel Request
                                                </LoadingButton>
                                                ) : null}

                                                {canEditRejected && (
                                                <div className="flex flex-col gap-2 w-full max-w-sm">
                                                    {ch.action !== 'delete' ? (
                                                        <textarea
                                                            rows={4}
                                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary text-xs font-mono bg-gray-50"
                                                            value={editPayload[ch.id] || ''}
                                                            onChange={e => setEditPayload(s => ({ ...s, [ch.id]: e.target.value }))}
                                                            placeholder='Edit payload JSON...'
                                                        />
                                                    ) : (
                                                    <div className="text-gray-500 text-xs italic text-right">Delete requests have no payload.</div>
                                                    )}
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <LoadingButton
                                                            onClick={() => modifyRejected(ch.id, ch.action, ch.requested_by)}
                                                            loading={rowLoading[ch.id]}
                                                            className="text-primary hover:text-primary/80 text-xs font-medium"
                                                        >
                                                            Resubmit
                                                        </LoadingButton>
                                                        <LoadingButton
                                                            onClick={() => deleteRejected(ch.id, ch.requested_by)}
                                                            loading={rowLoading[ch.id]}
                                                            className="text-gray-500 hover:text-red-600 text-xs"
                                                        >
                                                            Discard
                                                        </LoadingButton>
                                                    </div>
                                                </div>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {changes.length === 0 && !loading && (
                            <tr><td colSpan={18} className="px-3 py-8 text-center text-sm text-gray-500">No changes found.</td></tr>
                        )}
                      </tbody>
                    </table>
                </div>
            </div>

             <div className="bg-blue-50 border border-blue-100 rounded-md p-4 text-sm text-blue-900 flex items-start">
                 <span className="material-symbols-outlined text-blue-400 mr-2 text-lg">info</span>
                 <span>
                    {isTop ? (
                        <>As <strong>Top Management</strong>, you have authority to approve or reject pending changes.</>
                    ) : isFM ? (
                        <>As <strong>Financial Manager</strong>, you can track your pending requests, or modify/discard rejected ones to resubmit.</>
                    ) : (
                        <>Read-only view of model changes.</>
                    )}
                 </span>
            </div>

        </div>
      </main>
    </div>
  )
}