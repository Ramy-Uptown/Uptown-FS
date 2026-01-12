import React, { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function DraftUnits() {
  const [units, setUnits] = useState([])
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [linking, setLinking] = useState(false)
  
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')

  async function load() {
    try {
      setLoading(true)
      setError('')
      // Load CODED UNITS (INVENTORY_DRAFT without model assigned)
      const resp = await fetchWithAuth(`${API_URL}/api/units?status=INVENTORY_DRAFT&noModel=true&pageSize=500`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load drafts')
      setUnits(data.units || data.items || [])

      // Load models for dropdown
      const mResp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models?pageSize=500`)
      const mData = await mResp.json()
      if (mResp.ok) setModels(mData.items || [])
    } catch (e) {
      setError(e.message || String(e))
      notifyError(e, 'Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAll = () => {
    if (selectedIds.length === units.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(units.map(u => u.id))
    }
  }

  const handleLinkModel = async () => {
    if (selectedIds.length === 0) {
      notifyError('Please select at least one unit')
      return
    }
    if (!selectedModelId) {
      notifyError('Please select a model')
      return
    }
    if (!window.confirm(`Link ${selectedIds.length} units to the selected model? TM approval will be required for them to become AVAILABLE.`)) return

    try {
      setLinking(true)
      const resp = await fetchWithAuth(`${API_URL}/api/units/bulk-link-model`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitIds: selectedIds, modelId: Number(selectedModelId) })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Link failed')
      notifySuccess(data.message || `${data.updated} units linked to model`)
      setSelectedIds([])
      setSelectedModelId('')
      load() // Refresh list
    } catch (e) {
      notifyError(e, 'Failed to link model')
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={user?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="max-w-9xl mx-auto space-y-6">

             <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Draft Units</h2>
                     <p className="text-sm text-gray-500 mt-1">Pending Model Assignment.</p>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                 <div className="flex-1 min-w-[200px]">
                     <select
                        value={selectedModelId}
                        onChange={e => setSelectedModelId(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                        <option value="">-- Select Model to Assign --</option>
                        {models.map(m => (
                            <option key={m.id} value={m.id}>{m.model_name} ({m.model_code})</option>
                        ))}
                    </select>
                 </div>
                 <div className="flex items-center gap-4">
                     <span className="text-sm text-gray-500">
                        {selectedIds.length} unit{selectedIds.length !== 1 ? 's' : ''} selected
                    </span>
                     <LoadingButton
                        onClick={handleLinkModel}
                        disabled={selectedIds.length === 0 || !selectedModelId || linking}
                        loading={linking}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 shadow-sm"
                    >
                        Link Model
                    </LoadingButton>
                 </div>
            </div>

            <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="relative px-6 py-3 w-12">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.length === units.length && units.length > 0} 
                                        onChange={selectAll}
                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                    />
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">ID</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Zone</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Block</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Building</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading && (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i}><td colSpan={9} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                                ))
                            )}
                            {!loading && units.map(u => (
                                <tr key={u.id} className={`${selectedIds.includes(u.id) ? 'bg-green-50' : 'hover:bg-gray-50'} transition-colors`}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.includes(u.id)} 
                                            onChange={() => toggleSelect(u.id)}
                                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                        />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.id}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-mono font-semibold">{u.code}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.unit_type || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.zone || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.block_sector || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.building_number || '-'}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.unit_status}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{(u.created_at || '').replace('T', ' ').substring(0, 16)}</td>
                                </tr>
                            ))}
                            {!loading && units.length === 0 && (
                                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">No INVENTORY_DRAFT units found. You can create some using Bulk Unit Creation.</td></tr>
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
