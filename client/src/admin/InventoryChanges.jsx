import React, { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import PromptModal from '../components/PromptModal.jsx'
import UnitDetailsDrawer from '../components/UnitDetailsDrawer.jsx'

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

// Helper for currency formatting
const fmtMoney = (v) => (v || 0).toLocaleString('en-US', { style: 'currency', currency: 'EGP' })

export default function InventoryChanges() {
  const [tab, setTab] = useState('drafts') // 'drafts' | 'changes'
  
  // Changes State
  const [changes, setChanges] = useState([])
  const [loadingChanges, setLoadingChanges] = useState(false)
  const [status, setStatus] = useState('pending_approval')
  const [promptRejectId, setPromptRejectId] = useState(0)

  // Drafts State
  const [drafts, setDrafts] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  
  // Shared State
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsUnit, setDetailsUnit] = useState(null)
  
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')

  // Load Change Requests
  async function loadChanges() {
    try {
      setLoadingChanges(true)
      setError('')
      const q = new URLSearchParams()
      if (status) q.set('status', status)
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/changes?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load change requests')
      setChanges(data.changes || [])
    } catch (e) {
      setError(e.message || String(e))
      notifyError(e, 'Failed to load change requests')
    } finally {
      setLoadingChanges(false)
    }
  }

  // Load Inventory Drafts
  async function loadDrafts() {
    try {
      setLoadingDrafts(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/drafts`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load drafts')
      setDrafts(data.units || [])
    } catch (e) {
      setError(e.message || String(e))
      notifyError(e, 'Failed to load drafts')
    } finally {
      setLoadingDrafts(false)
    }
  }

  useEffect(() => {
    if (tab === 'changes') loadChanges()
    else loadDrafts()
  }, [tab, status])

  // Approve Change Request (Modification)
  async function approveChange(id) {
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/changes/${id}/approve`, { method: 'PATCH' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approve failed')
      setChanges(list => list.filter(c => c.id !== id))
      notifySuccess('Change approved')
    } catch (e) {
      notifyError(e, 'Approve failed')
    } finally {
      setBusyId(0)
    }
  }

  // Reject Change Request
  async function rejectChange(id, reason) {
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/changes/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || '' })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Reject failed')
      setChanges(list => list.filter(c => c.id !== id))
      notifySuccess('Change rejected')
    } catch (e) {
      notifyError(e, 'Reject failed')
    } finally {
      setBusyId(0)
    }
  }

  // Approve Draft (Make Available)
  async function approveDraft(unitId) {
    setBusyId(unitId)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/units/approve-model-link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitIds: [unitId] })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approval failed')
      setDrafts(list => list.filter(u => u.id !== unitId))
      notifySuccess('Unit approved and now Available')
    } catch (e) {
      notifyError(e, 'Approval failed')
    } finally {
      setBusyId(0)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={user?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 lg:ml-0 p-6">
        <div className="w-full mx-auto space-y-6">

            <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Unit Approvals</h2>
                     <p className="text-sm text-gray-500 mt-1">Review new unit drafts and modification requests.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setTab('drafts')}
                  className={`${
                    tab === 'drafts'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  New Unit Drafts
                  {drafts.length > 0 && (
                    <span className="bg-primary/10 text-primary py-0.5 px-2 rounded-full text-xs">{drafts.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setTab('changes')}
                  className={`${
                    tab === 'changes'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  Change Requests
                  {changes.length > 0 && status === 'pending_approval' && (
                    <span className="bg-amber-100 text-amber-800 py-0.5 px-2 rounded-full text-xs">{changes.length}</span>
                  )}
                </button>
              </nav>
            </div>

            {/* ERROR ALERT */}
            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

            {/* --- NEW UNIT DRAFTS TAB --- */}
            {tab === 'drafts' && (
              <div className="space-y-4">
                 <div className="flex justify-end">
                    <LoadingButton 
                        onClick={loadDrafts} 
                        loading={loadingDrafts}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                        Refresh List
                    </LoadingButton>
                 </div>
                 
                 <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">ID</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Model</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Price</th>
                                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created By</th>
                                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {loadingDrafts && Array.from({length:3}).map((_,i) => (
                                    <tr key={i}><td colSpan={6} className="px-3 py-4"><SkeletonRow widths={['lg']}/></td></tr>
                                ))}
                                {!loadingDrafts && drafts.length === 0 && (
                                    <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">No pending drafts found.</td></tr>
                                )}
                                {!loadingDrafts && drafts.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">{u.id}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-mono">{u.code}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                                            {u.model_name ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{u.model_name}</span>
                                                    <span className="text-xs text-gray-500">{u.model_code}</span>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 font-mono">
                                             {fmtMoney(u.base_price)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {u.created_by_email || '-'}
                                            <div className="text-xs text-gray-400">{(u.created_at||'').split('T')[0]}</div>
                                        </td>
                                        <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <div className="flex gap-2 justify-end">
                                              <LoadingButton
                                                  onClick={() => {
                                                    setDetailsUnit(u)
                                                    setDetailsOpen(true)
                                                  }}
                                                  className="text-gray-600 hover:text-gray-900 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-xs"
                                              >
                                                  Details
                                              </LoadingButton>
                                              <LoadingButton 
                                                  disabled={busyId === u.id} 
                                                  onClick={() => approveDraft(u.id)} 
                                                  loading={busyId === u.id} 
                                                  className="text-green-600 hover:text-green-900 bg-green-50 px-2 py-1 rounded border border-green-200 text-xs"
                                              >
                                                  Approve
                                              </LoadingButton>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </div>
                 <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-900">
                    <span className="material-symbols-outlined text-blue-500">info</span>
                    <div>
                         Approved drafts will become AVAILABLE in the inventory for sales.
                    </div>
                 </div>
              </div>
            )}

            {/* --- CHANGE REQUESTS TAB --- */}
            {tab === 'changes' && (
              <div className="space-y-4">
                 <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                     <div className="w-full sm:w-64">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Status</label>
                        <select 
                            value={status} 
                            onChange={e => setStatus(e.target.value)} 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        >
                            <option value="pending_approval">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="all">All</option>
                        </select>
                     </div>
                     <div className="flex items-end">
                        <LoadingButton 
                            onClick={loadChanges} 
                            loading={loadingChanges}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Refresh List
                        </LoadingButton>
                     </div>
                </div>
            
                <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Requested By</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Requested At</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Payload</th>
                                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {loadingChanges && (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}><td colSpan={7} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                                    ))
                                )}
                                {!loadingChanges && changes.map(ch => (
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
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{ch.requested_by_email || '-'}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{(ch.created_at || '').replace('T',' ').replace('Z','')}</td>
                                        <td className="px-3 py-4 text-sm text-gray-500 max-w-xs">{renderPayload(ch.payload)}</td>
                                        <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <div className="flex gap-2 justify-end">
                                                <LoadingButton
                                                  onClick={() => {
                                                    setDetailsUnit({ id: ch.unit_id, code: ch.unit_code || `#${ch.unit_id}`, unit_status: ch.unit_status })
                                                    setDetailsOpen(true)
                                                  }}
                                                  className="text-gray-600 hover:text-gray-900 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-xs"
                                                >
                                                  Details
                                                </LoadingButton>
                                                {status === 'pending_approval' && (
                                                    <>
                                                        <LoadingButton 
                                                            disabled={busyId === ch.id} 
                                                            onClick={() => approveChange(ch.id)} 
                                                            loading={busyId === ch.id} 
                                                            className="text-green-600 hover:text-green-900 bg-green-50 px-2 py-1 rounded border border-green-200 text-xs"
                                                        >
                                                            Approve
                                                        </LoadingButton>
                                                        <LoadingButton 
                                                            disabled={busyId === ch.id} 
                                                            onClick={() => setPromptRejectId(ch.id)} 
                                                            loading={busyId === ch.id} 
                                                            className="text-red-600 hover:text-red-900 bg-red-50 px-2 py-1 rounded border border-red-200 text-xs"
                                                        >
                                                            Reject
                                                        </LoadingButton>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!loadingChanges && changes.length === 0 && (
                                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">No change requests found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
              </div>
            )}

        </div>
      </main>

      <PromptModal
        open={!!promptRejectId}
        title="Reject Change Request"
        message="Optionally provide a reason for rejection:"
        placeholder="Reason (optional)"
        confirmText="Reject"
        cancelText="Cancel"
        onSubmit={(val) => { const id = promptRejectId; setPromptRejectId(0); rejectChange(id, val || '') }}
        onCancel={() => setPromptRejectId(0)}
      />
      <UnitDetailsDrawer unit={detailsUnit} open={detailsOpen} onClose={() => setDetailsOpen(false)} />
    </div>
  )
}