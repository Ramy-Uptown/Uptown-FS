import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import UnitDetailsDrawer from '../components/UnitDetailsDrawer.jsx'

export default function Units() {
  const navigate = useNavigate()
  const [units, setUnits] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [deletingIds, setDeletingIds] = useState(new Set())

  // unit models (used for filter and FA linking)
  const [models, setModels] = useState([])
  const [modelsError, setModelsError] = useState('')
  const [filterModelId, setFilterModelId] = useState('')
  const modelMap = React.useMemo(() => {
    const m = {}
    models.forEach(x => { m[x.id] = x })
    return m
  }, [models])

  // current user role
  const role = JSON.parse(localStorage.getItem('auth_user') || '{}')?.role
  const isCrmInventoryAdmin = role === 'crm_admin'

  // form state
  const [form, setForm] = useState({
    code: '',
    description: '',
    unit_type: '',
    base_price: '',
    currency: 'EGP',
    model_id: '',
    // Optional inventory metadata (FA can send these on create)
    unit_number: '',
    floor: '',
    building_number: '',
    block_sector: '',
    zone: '',
    garden_details: ''
  })
  const [editingId, setEditingId] = useState(0)
  const [editingStatus, setEditingStatus] = useState('')
  const [saving, setSaving] = useState(false)

  async function load(p = page) {
    try {
      setLoading(true)
      setError('')
      const q = new URLSearchParams()
      if (search) q.set('search', search)
      if (filterModelId) q.set('model_id', String(filterModelId))
      q.set('page', String(p))
      q.set('pageSize', String(pageSize))
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load units')
      setUnits(data.units || [])
      setTotal(Number(data.pagination?.total || 0))
    } catch (e) {
      setError(e.message || String(e))
      notifyError(e, 'Failed to load units')
    } finally {
      setLoading(false)
    }
  }

  // Load models for filter and FA linking (attempt for any role; ignore auth errors)
  useEffect(() => {
    let abort = false
    async function run() {
      try {
        setModelsError('')
        const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models?page=1&pageSize=500`)
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load unit models')
        if (!abort) setModels(data.items || [])
      } catch (e) {
        // Silently ignore if not authorized; filter will be hidden
        if (!abort) setModelsError(String(e.message || e))
      }
    }
    run()
    return () => { abort = true }
  }, [role])

  useEffect(() => { load(1) }, [search, pageSize, filterModelId])
  useEffect(() => { load(page) }, [page])

  function resetForm() {
    setForm({
      code: '',
      description: '',
      unit_type: '',
      base_price: '',
      currency: 'EGP',
      model_id: '',
      unit_number: '',
      floor: '',
      building_number: '',
      block_sector: '',
      zone: '',
      garden_details: ''
    })
    setEditingId(0)
  }

  async function saveUnit(e) {
    e && e.preventDefault()
    try {
      setSaving(true)
      let resp
      let createdOrEditedId = editingId

      if (isCrmInventoryAdmin) {
        // CRM Admin: draft creation, draft update, or change-request for approved units
        if (editingId) {
          if (editingStatus && editingStatus !== 'INVENTORY_DRAFT') {
            // Request change for approved unit
            const payload = {
              code: String(form.code || '').trim(),
              unit_number: form.unit_number || null,
              floor: form.floor || null,
              building_number: form.building_number || null,
              block_sector: form.block_sector || null,
              zone: form.zone || null,
              model_id: form.model_id ? Number(form.model_id) : null
            }
            resp = await fetchWithAuth(`${API_URL}/api/inventory/units/${editingId}/change-request`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update', payload })
            })
            const data = await resp.json()
            if (!resp.ok) throw new Error(data?.error?.message || 'Request failed')
            notifySuccess('Edit request submitted to Top Management.')
          } else {
            // Update allowed fields on draft
            const body = {
              code: String(form.code || '').trim(),
              unit_number: form.unit_number || null,
              floor: form.floor || null,
              building_number: form.building_number || null,
              block_sector: form.block_sector || null,
              zone: form.zone || null
            }
            resp = await fetchWithAuth(`${API_URL}/api/inventory/units/${editingId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            })
            const data = await resp.json()
            if (!resp.ok) throw new Error(data?.error?.message || 'Save failed')
            createdOrEditedId = editingId
            notifySuccess('Draft updated')
          }
        } else {
          // Create draft linked to a model (required)
          if (!form.model_id) {
            throw new Error('Please select a unit model to link. It is required.')
          }
          const faBody = {
            code: String(form.code || '').trim(),
            model_id: Number(form.model_id),
            // include optional inventory metadata if provided
            unit_number: form.unit_number || undefined,
            floor: form.floor || undefined,
            building_number: form.building_number || undefined,
            block_sector: form.block_sector || undefined,
            zone: form.zone || undefined
          }
          if (!faBody.code) throw new Error('Code is required')
          resp = await fetchWithAuth(`${API_URL}/api/inventory/units`, { // Use inventory route
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(faBody)
          })
          const data = await resp.json()
          if (!resp.ok) throw new Error(data?.error?.message || 'Save failed')
          createdOrEditedId = data?.unit?.id
          notifySuccess('Unit draft created and linked to model. Awaiting Top Management approval.')
        }
      } else { // Superadmin path
        const body = {
          ...form,
          base_price: Number(form.base_price) || 0,
          currency: (form.currency || 'EGP').toUpperCase(),
          ...(form.model_id ? { model_id: Number(form.model_id) } : {})
        }
        if (editingId) {
          resp = await fetchWithAuth(`${API_URL}/api/units/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        } else {
          resp = await fetchWithAuth(`${API_URL}/api/units`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        }
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error?.message || 'Save failed')
        createdOrEditedId = editingId || data?.unit?.id
        notifySuccess(editingId ? 'Unit updated' : 'Unit created')
      }

      resetForm()
      await load()
    } catch (e) {
      notifyError(e, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function edit(u) {
    setEditingId(u.id)
    setEditingStatus(u.unit_status || '')
    setForm({
      code: u.code || '',
      description: u.description || '',
      unit_type: u.unit_type || '',
      base_price: String(u.base_price ?? ''),
      currency: u.currency || 'EGP',
      model_id: u.model_id ? String(u.model_id) : '',
      unit_number: u.unit_number || '',
      floor: u.floor || '',
      building_number: u.building_number || '',
      block_sector: u.block_sector || '',
      zone: u.zone || '',
      garden_details: u.garden_details || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsUnit, setDetailsUnit] = useState(null)

  async function performDelete(id) {
    // optimistic removal
    const prev = units
    setUnits(u => u.filter(x => x.id !== id))
    setTotal(t => Math.max(0, t - 1))
    setDeletingIds(s => new Set([...s, id]))
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/units/${id}`, { method: 'DELETE' })
      let msg = ''
      try {
        const j = await resp.json()
        msg = j?.error?.message || ''
      } catch {}
      if (!resp.ok) {
        setUnits(prev)
        setTotal(t => t + 1)
        notifyError({ message: msg || 'Delete failed' })
      } else {
        notifySuccess('Unit deleted successfully.')
      }
    } catch (e) {
      setUnits(prev)
      setTotal(t => t + 1)
      notifyError(e, 'Delete failed')
    } finally {
      setDeletingIds(s => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 lg:ml-0 p-6">
        <div className="w-full mx-auto space-y-6">
            
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Units Catalog</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage inventory, pricing, and unit details.</p>
                </div>
                {isCrmInventoryAdmin && (
                  <LoadingButton 
                    onClick={() => navigate('/admin/units/bulk-create')}
                    variant="primary"
                  >
                    Bulk Create Drafts
                  </LoadingButton>
                )}
            </div>

            {/* Input Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <form onSubmit={saveUnit} className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input 
                            placeholder="Code (Required)" 
                            value={form.code} 
                            onChange={e => setForm(s => ({ ...s, code: e.target.value }))} 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            required 
                        />
                        {!isCrmInventoryAdmin && (
                            <>
                                <input 
                                    placeholder="Description" 
                                    value={form.description} 
                                    onChange={e => setForm(s => ({ ...s, description: e.target.value }))} 
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                                <input 
                                    placeholder="Unit Type" 
                                    value={form.unit_type} 
                                    onChange={e => setForm(s => ({ ...s, unit_type: e.target.value }))} 
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                                <div className="flex gap-2">
                                     <input 
                                        type="number" 
                                        placeholder="Base Price" 
                                        value={form.base_price} 
                                        onChange={e => setForm(s => ({ ...s, base_price: e.target.value }))} 
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                     />
                                     <select 
                                        value={form.currency} 
                                        onChange={e => setForm(s => ({ ...s, currency: e.target.value }))} 
                                        className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                     >
                                        <option value="EGP">EGP</option>
                                        <option value="USD">USD</option>
                                        <option value="SAR">SAR</option>
                                        <option value="EUR">EUR</option>
                                        <option value="AED">AED</option>
                                        <option value="KWD">KWD</option>
                                    </select>
                                </div>
                            </>
                        )}
                        {isCrmInventoryAdmin && (
                            <>
                                <input 
                                    placeholder="Unit Number" 
                                    value={form.unit_number} 
                                    onChange={e => setForm(s => ({ ...s, unit_number: e.target.value }))} 
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                                <input 
                                    placeholder="Floor" 
                                    value={form.floor} 
                                    onChange={e => setForm(s => ({ ...s, floor: e.target.value }))} 
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                                <input 
                                    placeholder="Building Number" 
                                    value={form.building_number} 
                                    onChange={e => setForm(s => ({ ...s, building_number: e.target.value }))} 
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                                <input 
                                    placeholder="Block/Sector" 
                                    value={form.block_sector} 
                                    onChange={e => setForm(s => ({ ...s, block_sector: e.target.value }))} 
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                                <input 
                                    placeholder="Zone" 
                                    value={form.zone} 
                                    onChange={e => setForm(s => ({ ...s, zone: e.target.value }))} 
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </>
                        )}
                         {isCrmInventoryAdmin && (
                             <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-blue-50 p-4 rounded-md border border-blue-100 flex flex-col md:flex-row gap-4 items-start md:items-center">
                                 <div className="flex-1">
                                     <label className="block text-sm font-medium text-blue-900 mb-1">Link to Unit Model (Required)</label>
                                     <select 
                                        value={form.model_id} 
                                        onChange={e => setForm(s => ({ ...s, model_id: e.target.value }))} 
                                        className="block w-full rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        required
                                     >
                                        <option value="">— Select a model —</option>
                                        {models.map(m => (
                                            <option key={m.id} value={m.id}>
                                            {m.model_code ? `${m.model_code} — ` : ''}{m.model_name} {m.area ? `(${m.area} m²)` : ''}
                                            </option>
                                        ))}
                                     </select>
                                     {modelsError && <p className="mt-1 text-xs text-red-600">{modelsError}</p>}
                                 </div>
                                 <div className="flex-1 text-xs text-blue-700 leading-snug">
                                     CRM Admin must select a model with approved standard pricing. The unit will be created as a draft already linked to the selected model, with prices and areas propagated. Top Management approval is required to finalize.
                                 </div>
                             </div>
                        )}
                     </div>
                     <div className="flex justify-end gap-3 pt-2">
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
                            className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        >
                            {saving ? 'Saving…' : (editingId ? 'Update Unit' : 'Create Unit')}
                        </LoadingButton>
                     </div>
                </form>
            </div>


            {/* Filtering */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <input 
                        placeholder="Search code…" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        className="block w-full md:w-64 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                    {models.length > 0 && (
                        <select 
                            value={filterModelId} 
                            onChange={e => setFilterModelId(e.target.value)} 
                            className="block w-full md:w-64 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        >
                            <option value="">All Models</option>
                            {models.map(m => (
                                <option key={m.id} value={m.id}>
                                {m.model_code ? `${m.model_code} — ` : ''}{m.model_name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                 <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <span className="text-sm text-gray-500">Rows:</span>
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
            </div>

            {error && (
                 <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                         <div className="flex-shrink-0">
                             <span className="material-symbols-outlined text-red-400">error</span>
                         </div>
                         <div className="ml-3">
                             <h3 className="text-sm font-medium text-red-800">Error loading units</h3>
                             <div className="mt-2 text-sm text-red-700">{error}</div>
                         </div>
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
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit No.</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Floor</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Building</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Block/Sector</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Zone</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit Model</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Area (m²)</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garden</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Roof</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Total Price</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Currency</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                          <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {loading && (
                            Array.from({ length: pageSize }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="py-4 pl-4 pr-3 sm:pl-6"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                                    {Array.from({length: 13}).map((_, j) => (
                                        <td key={j} className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                                    ))}
                                    <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-8 ml-auto"></div></td>
                                </tr>
                            ))
                        )}
                        {!loading && units.map(unit => {
                             const statusColor = 
                                unit.unit_status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                                unit.unit_status === 'BLOCKED' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800';
                             return (
                                <tr key={unit.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{unit.id}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">{unit.code}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{unit.unit_number || '-'}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{unit.floor || '-'}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{unit.building_number || '-'}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{unit.block_sector || '-'}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{unit.zone || '-'}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 max-w-[150px] truncate">
                                    {(() => {
                                      const fromApi = unit.model_code ? `${unit.model_code} — ${unit.model_name || ''}`.trim() : (unit.model_name || '')
                                      if (fromApi) return fromApi
                                      const m = modelMap[unit.model_id]
                                      if (m) return m.model_code ? `${m.model_code} — ${m.model_name}` : (m.model_name || `#${unit.model_id}`)
                                      return unit.model_id ? `#${unit.model_id}` : '-'
                                    })()}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">{unit.area ? Number(unit.area).toLocaleString() : '-'}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{unit.garden_available ? `Yes` : 'No'}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{unit.roof_available ? `Yes` : 'No'}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right font-mono font-medium">{unit.total_price ? Number(unit.total_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{unit.currency}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${statusColor}`}>
                                        {unit.unit_status}
                                      </span>
                                  </td>
                                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                    <div className="flex gap-2 justify-end">
                                        <button 
                                            onClick={() => { setDetailsUnit(unit); setDetailsOpen(true) }}
                                            className="text-primary hover:text-primary/80"
                                        >
                                            Details
                                        </button>
                                        {isCrmInventoryAdmin ? (
                                          <>
                                            {unit.unit_status === 'INVENTORY_DRAFT' ? (
                                              <>
                                                <button onClick={() => edit(unit)} className="text-gray-600 hover:text-gray-900">Edit</button>
                                                <button onClick={() => setConfirmDeleteId(unit.id)} className="text-red-600 hover:text-red-900" disabled={deletingIds.has(unit.id)}>
                                                  Delete
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button onClick={() => edit(unit)} className="text-gray-600 hover:text-gray-900">Req. Edit</button>
                                                <button 
                                                    onClick={async () => {
                                                        try {
                                                        const resp = await fetchWithAuth(`${API_URL}/api/inventory/units/${unit.id}/change-request`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ action: 'delete' })
                                                        })
                                                        const data = await resp.json()
                                                        if (!resp.ok) throw new Error(data?.error?.message || 'Request failed')
                                                        notifySuccess('Delete request submitted.')
                                                        } catch (e) {
                                                        notifyError(e, 'Delete request failed')
                                                        }
                                                    }}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                  Req. Delete
                                                </button>
                                              </>
                                            )}
                                          </>
                                        ) : (
                                          <>
                                            <button onClick={() => edit(unit)} className="text-gray-600 hover:text-gray-900">Edit</button>
                                            <button onClick={() => setConfirmDeleteId(unit.id)} className="text-red-600 hover:text-red-900" disabled={deletingIds.has(unit.id)}>
                                              Delete
                                            </button>
                                          </>
                                        )}
                                    </div>
                                  </td>
                                </tr>
                             )
                        })}
                        {units.length === 0 && !loading && (
                            <tr>
                                <td colSpan={15} className="px-3 py-8 text-center text-sm text-gray-500">
                                    No units found.
                                </td>
                            </tr>
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

        <ConfirmModal
            open={!!confirmDeleteId}
            title="Delete Unit"
            message="Are you sure you want to delete this unit? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            onConfirm={() => { const id = confirmDeleteId; setConfirmDeleteId(0); performDelete(id) }}
            onCancel={() => setConfirmDeleteId(0)}
        />
        <UnitDetailsDrawer unit={detailsUnit} open={detailsOpen} onClose={() => setDetailsOpen(false)} />
      </main>
    </div>
  )
}