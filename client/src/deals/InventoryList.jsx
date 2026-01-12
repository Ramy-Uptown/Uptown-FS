import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { useNavigate } from 'react-router-dom'
import UnitDetailsTable from '../components/UnitDetailsTable.jsx'
import { UnitCardsGrid } from '../components/UnitDetailsCard.jsx'
import LoadingButton from '../components/LoadingButton.jsx'

export default function InventoryList() {
  const navigate = useNavigate()
  const [units, setUnits] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('')
  const [types, setTypes] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // Role-based defaults:
  const role = (() => {
    try {
      return JSON.parse(localStorage.getItem('auth_user') || '{}')?.role || ''
    } catch {
      return ''
    }
  })()
  const initialLayout = (role === 'property_consultant' || role === 'sales_manager') ? 'grid' : 'table'
  const initialGridMode = (role === 'property_consultant' || role === 'sales_manager') ? 'compact' : 'expanded'
  const initialTableMode = (role === 'financial_manager' || role === 'financial_admin' || role === 'admin' || role === 'superadmin') ? 'expanded' : 'compact'

  const [layout, setLayout] = useState(initialLayout) // 'table' | 'grid'
  const [gridMode, setGridMode] = useState(initialGridMode) // 'compact' | 'expanded'
  const [tableMode, setTableMode] = useState(initialTableMode) // 'compact' | 'expanded'

  useEffect(() => {
    async function loadTypes() {
      try {
        const resp = await fetchWithAuth(`${API_URL}/api/inventory/types`)
        const data = await resp.json()
        if (resp.ok) setTypes(data.unit_types || [])
      } catch {}
    }
    loadTypes()
  }, [])

  async function load(p = 1) {
    try {
      setLoading(true)
      setError('')
      const q = new URLSearchParams()
      if (search) q.set('search', search)
      if (typeId) q.set('unit_type_id', typeId)
      q.set('page', String(p))
      q.set('pageSize', String(pageSize))
      // Sales roles will see only AVAILABLE + unblocked units via server-side filters
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/units?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load inventory')
      setUnits(data.units || [])
      setTotal(data.pagination?.total || 0)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeId, pageSize])

  useEffect(() => {
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Inventory</h2>
            <p className="text-sm text-gray-500 mt-1">Browse and filter available units.</p>
         </div>
         <div className="flex flex-wrap items-center gap-3">
             <button 
               onClick={() => navigate('/deals/create')} 
               className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
             >
                <span className="material-symbols-outlined text-[20px] mr-2">calculate</span>
                Go to Calculator
             </button>
             <div className="bg-white border border-gray-300 rounded-lg p-1 flex">
                 <button 
                    onClick={() => setLayout('table')} 
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${layout === 'table' ? 'bg-primary/10 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                 >
                    <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">table_rows</span>
                        Table
                    </span>
                 </button>
                 <button 
                    onClick={() => setLayout('grid')} 
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${layout === 'grid' ? 'bg-primary/10 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                 >
                    <span className="flex items-center gap-2">
                         <span className="material-symbols-outlined text-[18px]">grid_view</span>
                         Grid
                    </span>
                 </button>
             </div>
         </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
         <input 
            placeholder="Search code/description…" 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1) }} 
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
         />
         <select 
            value={typeId} 
            onChange={e => { setTypeId(e.target.value); setPage(1) }} 
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
         >
            <option value="">All types</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
         </select>
         <select 
            value={pageSize} 
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} 
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
         >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
         </select>

         {layout === 'grid' ? (
           <select 
                value={gridMode} 
                onChange={e => setGridMode(e.target.value)} 
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            >
             <option value="compact">Compact View</option>
             <option value="expanded">Expanded View</option>
           </select>
         ) : (
           <select 
                value={tableMode} 
                onChange={e => setTableMode(e.target.value)} 
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            >
             <option value="compact">Compact View</option>
             <option value="expanded">Expanded View</option>
           </select>
         )}

         <LoadingButton 
            onClick={() => load(1)} 
            disabled={loading} 
            loading={loading}
            className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
         >
            Refresh
         </LoadingButton>
      </div>

      {error && (
         <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
               <div className="flex-shrink-0">
                  <span className="material-symbols-outlined text-red-400">error</span>
               </div>
               <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error loading inventory</h3>
                  <div className="mt-2 text-sm text-red-700">
                     <p>{error}</p>
                  </div>
               </div>
            </div>
         </div>
      )}

      {!loading && units.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
            <span className="mx-auto h-12 w-12 text-gray-400 block material-symbols-outlined text-[48px]">inventory_2</span>
            <span className="mt-2 block text-sm font-medium text-gray-900">No units found</span>
            <p className="mt-1 text-sm text-gray-500">
                {(role === 'property_consultant' || role === 'sales_manager') 
                    ? "Ask a manager to approve inventory drafts to make them visible." 
                    : "Try adjusting your search or filters."}
            </p>
        </div>
      ) : (
        <>
          {layout === 'table' ? (
            <div className="bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 overflow-hidden">
                <UnitDetailsTable
                    units={units}
                    loading={loading}
                    onCreateOffer={(u) => {
                        if (u.unit_status === 'BLOCKED') {
                        alert('This unit is currently blocked.')
                        return
                        }
                        navigate(`/deals/create?unit_id=${u.id}`)
                    }}
                    mode={tableMode}
                />
            </div>
          ) : (
            <UnitCardsGrid
              units={units}
              onCreateOffer={(u) => {
                if (u.unit_status === 'BLOCKED') {
                  alert('This unit is currently blocked.')
                  return
                }
                navigate(`/deals/create?unit_id=${u.id}`)
              }}
              mode={gridMode}
            />
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg shadow-sm">
             <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                   <p className="text-sm text-gray-700">
                      Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span> — <span className="font-medium">{total}</span> results
                   </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        First
                    </button>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Next
                    </button>
                    <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Last
                    </button>
                </div>
             </div>
          </div>
        </>
      )}
    </div>
  )
}