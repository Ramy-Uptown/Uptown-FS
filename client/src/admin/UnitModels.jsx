import React, { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function UnitModels() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(0)
  const [form, setForm] = useState({
    model_name: '',
    model_code: '',
    area: '',
    orientation: 'left',
    has_garden: false,
    garden_area: '',
    has_roof: false,
    roof_area: '',
    garage_area: ''
  })

  // user role (for sidebar)
  const role = JSON.parse(localStorage.getItem('auth_user') || '{}')?.role

  // History modal
  const [historyForId, setHistoryForId] = useState(null)
  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  function resetForm() {
    setForm({
      model_name: '',
      model_code: '',
      area: '',
      orientation: 'left',
      has_garden: false,
      garden_area: '',
      has_roof: false,
      roof_area: '',
      garage_area: ''
    })
    setEditingId(0)
  }

  function friendlyError(e, fallback) {
    const msg = (e && e.message) ? e.message : String(e || '')
    if (!navigator.onLine) return 'You appear to be offline.'
    if (/Failed to fetch|NetworkError|TypeError/i.test(msg)) {
      return 'Cannot reach the API server. Please ensure containers are running.'
    }
    return msg || fallback
  }

  async function load(p = page) {
    try {
      setLoading(true)
      setError('')
      const q = new URLSearchParams()
      if (search) q.set('search', search)
      q.set('page', String(p))
      q.set('pageSize', String(pageSize))
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load models')
      setItems(data.items || data.models || [])
      setTotal(data.pagination?.total || data.total || 0)
    } catch (e) {
      setError(friendlyError(e, 'Failed to load models'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [search, pageSize])
  useEffect(() => { load(page) }, [page])

  async function save(e) {
    e && e.preventDefault()
    try {
      setSaving(true)
      const body = {
        model_name: (form.model_name || '').trim(),
        model_code: (form.model_code || '').trim() || null,
        area: Number(form.area) || 0,
        orientation: form.orientation || 'left',
        has_garden: !!form.has_garden,
        garden_area: form.has_garden ? (Number(form.garden_area) || 0) : 0,
        has_roof: !!form.has_roof,
        roof_area: form.has_roof ? (Number(form.roof_area) || 0) : 0,
        garage_area: Number(form.garage_area) || 0
      }
      let resp
      if (editingId) {
        resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      } else {
        resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      }
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Save failed')
      notifySuccess(editingId ? 'Update request submitted' : 'Create request submitted')
      resetForm()
      await load()
    } catch (e) {
      notifyError(e, friendlyError(e, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm({
      model_name: item.model_name || '',
      model_code: item.model_code || '',
      area: String(item.area ?? ''),
      orientation: item.orientation || 'left',
      has_garden: !!item.has_garden,
      garden_area: String(item.garden_area ?? ''),
      has_roof: !!item.has_roof,
      roof_area: String(item.roof_area ?? ''),
      garage_area: String(item.garage_area ?? '')
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(id) {
    if (!confirm('Delete this model?')) return
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/${id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Delete failed')
      notifySuccess('Delete request submitted')
      await load()
    } catch (e) {
      notifyError(e, friendlyError(e, 'Delete failed'))
    }
  }

  async function openHistory(id) {
    setHistoryForId(id)
    setHistoryLoading(true)
    setHistoryItems([])
    try {
      // Fetch applied audit entries
      const [auditResp, pendingResp, rejectedResp] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/inventory/unit-models/${id}/audit`),
        fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes?status=pending_approval`),
        fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes?status=rejected`)
      ])
      const auditData = await auditResp.json().catch(() => ({}))
      if (!auditResp.ok) throw new Error(auditData?.error?.message || 'Failed to load history')
      const auditItems = (auditData.audit || []).map(a => ({ ...a, _kind: 'audit' }))

      // Fetch pending and rejected change requests and filter for this model
      const pendingData = await pendingResp.json().catch(() => ({}))
      const rejectedData = await rejectedResp.json().catch(() => ({}))
      const byStatus = (src, status) => (src?.changes || []).filter(ch => Number(ch.model_id) === Number(id)).map(ch => ({
        id: `change-${ch.id}`,
        action: ch.action,
        changed_by: ch.requested_by,
        changed_by_email: ch.requested_by_email,
        created_at: ch.created_at,
        details: { status, payload: ch.payload, reason: ch.reason || null },
        _kind: 'change',
        _status: status
      }))
      const changeItems = [
        ...byStatus(pendingData, 'pending_approval'),
        ...byStatus(rejectedData, 'rejected')
      ]

      // Merge and sort by created_at desc
      const merged = [...auditItems, ...changeItems].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta
      })
      setHistoryItems(merged)
    } catch (e) {
      notifyError(e, friendlyError(e, 'Failed to load history'))
    } finally {
      setHistoryLoading(false)
    }
  }

  function closeHistory() {
    setHistoryForId(null)
    setHistoryItems([])
    setHistoryLoading(false)
  }

  const orientationOptions = [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'whole_floor', label: 'Whole Floor' }
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="w-full mx-auto space-y-6">
            
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Unit Models</h2>
                    <p className="text-sm text-gray-500 mt-1">Define standard unit specifications and areas.</p>
                </div>
                {editingId ? (
                    <button 
                        type="button" 
                        onClick={resetForm} 
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                        Create New
                    </button>
                ) : null}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <span className="text-sm text-blue-900">
                    <strong>Note:</strong> Create/update/delete requests require Top Management approval.
                    Track status in <a href="/admin/unit-model-changes" className="underline hover:text-blue-700">Unit Model Changes</a>.
                </span>
                <div className="flex flex-wrap gap-2">
                     <a href="/admin/unit-model-changes?status=pending_approval" className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200">
                        View Pending
                     </a>
                     <a href="/admin/unit-model-changes?status=rejected" className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200">
                        View Rejected
                     </a>
                     <button  
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); resetForm(); }}
                     >
                        New Request
                     </button>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <form onSubmit={save} className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input 
                            placeholder="Model Name (Required)" 
                            value={form.model_name} 
                            onChange={e => setForm(s => ({ ...s, model_name: e.target.value }))} 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            required
                        />
                         <input 
                            placeholder="Model Code" 
                            value={form.model_code || ''} 
                            onChange={e => setForm(s => ({ ...s, model_code: e.target.value }))} 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        />
                         <input 
                            type="number"
                            placeholder="Area (m², Required)" 
                            value={form.area} 
                            onChange={e => setForm(s => ({ ...s, area: e.target.value }))} 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            required
                        />
                        <select 
                            value={form.orientation} 
                            onChange={e => setForm(s => ({ ...s, orientation: e.target.value }))} 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        >
                            {orientationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end border-t border-gray-100 pt-4">
                         {/* Garden */}
                         <div>
                            <label className="flex items-center gap-2 mb-2">
                                <input 
                                    type="checkbox" 
                                    checked={form.has_garden} 
                                    onChange={e => setForm(s => ({ ...s, has_garden: e.target.checked, garden_area: e.target.checked ? s.garden_area : '' }))} 
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">Has Garden</span>
                            </label>
                            <input 
                                type="number" 
                                placeholder="Garden Area (m²)" 
                                value={form.garden_area} 
                                onChange={e => setForm(s => ({ ...s, garden_area: e.target.value }))} 
                                disabled={!form.has_garden}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-100"
                            />
                         </div>

                         {/* Roof */}
                         <div>
                            <label className="flex items-center gap-2 mb-2">
                                <input 
                                    type="checkbox" 
                                    checked={form.has_roof} 
                                    onChange={e => setForm(s => ({ ...s, has_roof: e.target.checked, roof_area: e.target.checked ? s.roof_area : '' }))} 
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">Has Roof</span>
                            </label>
                            <input 
                                type="number" 
                                placeholder="Roof Area (m²)" 
                                value={form.roof_area} 
                                onChange={e => setForm(s => ({ ...s, roof_area: e.target.value }))} 
                                disabled={!form.has_roof}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-100"
                            />
                         </div>

                         {/* Garage */}
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Garage Area</label>
                            <input 
                                type="number" 
                                placeholder="m²" 
                                value={form.garage_area} 
                                onChange={e => setForm(s => ({ ...s, garage_area: e.target.value }))} 
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                         </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        <span className="text-xs text-gray-500">
                             Garden and Roof areas are optional if not applicable.
                        </span>
                        <div className="flex gap-3">
                             {editingId ? (
                                <button 
                                    type="button" 
                                    onClick={resetForm} 
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                                >
                                    Cancel
                                </button>
                             ) : null}
                             <LoadingButton 
                                type="submit" 
                                loading={saving} 
                                className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
                            >
                                {saving ? 'Submitting…' : (editingId ? 'Submit Update' : 'Submit Create')}
                            </LoadingButton>
                        </div>
                    </div>
                </form>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <input 
                    placeholder="Search models…" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="block w-full md:w-64 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
                <select 
                    value={pageSize} 
                    onChange={e => setPageSize(Number(e.target.value))} 
                    className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
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
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Model Name</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Area (m²)</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Orientation</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garden</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Roof</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Garage Area</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Updated</th>
                          <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {loading && (
                           Array.from({ length: pageSize }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                                <td colSpan={11} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td>
                            </tr>
                           ))
                        )}
                        {!loading && items.map(it => (
                            <tr key={it.id} className="hover:bg-gray-50 transition-colors">
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{it.id}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">{it.model_name}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{it.model_code}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{Number(it.area || 0).toLocaleString()}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">{String(it.orientation || '').replace(/_/g, ' ')}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{it.has_garden ? `Yes${it.garden_area ? ` (${it.garden_area} m²)` : ''}` : 'No'}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{it.has_roof ? `Yes${it.roof_area ? ` (${it.roof_area} m²)` : ''}` : 'No'}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{it.garage_area || 0}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-xs">{it.created_at ? new Date(it.created_at).toLocaleString() : '—'}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-xs">{it.updated_at ? new Date(it.updated_at).toLocaleString() : '—'}</td>
                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => startEdit(it)} className="text-primary hover:text-primary/80">Edit</button>
                                        <button onClick={() => openHistory(it.id)} className="text-gray-600 hover:text-gray-900">History</button>
                                        <button onClick={() => remove(it.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && !loading && (
                            <tr><td colSpan={11} className="px-3 py-8 text-center text-sm text-gray-500">No models found.</td></tr>
                        )}
                      </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg shadow-sm">
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-700">
                            Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span> — <span className="font-medium">{total}</span> total
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setPage(1)} disabled={page === 1 || loading} className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">First</button>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Previous</button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
                        <button onClick={() => setPage(totalPages)} disabled={page >= totalPages || loading} className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Last</button>
                    </div>
                </div>
            </div>

        </div>

        {/* History Modal */}
        {historyForId !== null && (
          <div className="fixed inset-0 z-[2000] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeHistory}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full sm:p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Change History — Model #{historyForId}</h3>
                        <button 
                            onClick={closeHistory}
                            type="button" 
                            className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        >
                            <span className="sr-only">Close</span>
                             <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="mt-2 max-h-[60vh] overflow-y-auto">
                         {historyLoading ? (
                              <div className="space-y-4">
                                <SkeletonRow widths={['lg']} tdStyle={{ padding: 0 }} />
                                <SkeletonRow widths={['md','lg']} tdStyle={{ padding: 0 }} />
                            </div>
                         ) : historyItems.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">No history found.</p>
                         ) : (
                             <ul className="space-y-4">
                                {historyItems.map((h, idx) => (
                                    <li key={h.id || idx} className="bg-gray-50 rounded-md p-3 text-sm">
                                        <div className="flex gap-2 items-center flex-wrap mb-1">
                                            <span className="font-bold text-gray-800 uppercase text-xs tracking-wide">{h.action || 'update'}</span>
                                            {h._kind === 'change' ? (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${h._status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {h._status}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold bg-green-100 text-green-800">
                                                    Applied
                                                </span>
                                            )}
                                            <span className="text-gray-400 text-xs ml-auto">{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</span>
                                        </div>
                                         <div className="text-gray-600 text-xs mb-2">By: {h.changed_by_email || h.changed_by || 'Unknown'}</div>
                                         {h.details && (
                                            <div className="bg-white border border-gray-200 rounded p-2 text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                                                {typeof h.details === 'string' ? h.details : JSON.stringify(h.details, null, 2)}
                                            </div>
                                         )}
                                    </li>
                                ))}
                             </ul>
                         )}
                    </div>

                     <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-1 sm:gap-3 sm:grid-flow-row-dense">
                        <button 
                            type="button" 
                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:col-start-1 sm:text-sm"
                            onClick={closeHistory}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}