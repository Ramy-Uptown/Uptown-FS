import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import * as XLSX from 'xlsx'
import { useLoader } from '../lib/loaderContext.jsx'

export default function Dashboard() {
  const [deals, setDeals] = useState([])
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [creatorEmail, setCreatorEmail] = useState('')
  const [reviewerEmail, setReviewerEmail] = useState('')
  const [approverEmail, setApproverEmail] = useState('')
  const [unitType, setUnitType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [sortBy, setSortBy] = useState('id')
  const [sortDir, setSortDir] = useState('desc')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [deletingIds, setDeletingIds] = useState(new Set())
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')

  // Optional deep-link filter: when unitId is provided in the query string,
  // use /api/deals/by-unit/:unitId instead of the generic listing.
  const location = useLocation()
  const navigate = useNavigate()
  const [unitIdFilter, setUnitIdFilter] = useState(null)

  async function load(p = page) {
    try {
      setLoading(true)
      setError('')

      // If unitIdFilter is set, use the specialized endpoint and ignore
      // most filters to present a unit-focused view.
      if (unitIdFilter) {
        const resp = await fetchWithAuth(`${API_URL}/api/deals/by-unit/${unitIdFilter}`)
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load deals for unit')
        const list = data.deals || []
        setDeals(list)
        setTotal(list.length)
        return
      }

      const q = new URLSearchParams()
      if (status) q.set('status', status)
      if (search) q.set('search', search)
      if (creatorEmail) q.set('creatorEmail', creatorEmail)
      if (reviewerEmail) q.set('reviewerEmail', reviewerEmail)
      if (approverEmail) q.set('approverEmail', approverEmail)
      if (unitType) q.set('unitType', unitType)
      if (startDate) q.set('startDate', startDate)
      if (endDate) q.set('endDate', endDate)
      if (minAmount) q.set('minAmount', minAmount)
      if (maxAmount) q.set('maxAmount', maxAmount)
      if (sortBy) q.set('sortBy', sortBy)
      if (sortDir) q.set('sortDir', sortDir)
      q.set('page', String(p))
      q.set('pageSize', String(pageSize))
      const resp = await fetchWithAuth(`${API_URL}/api/deals?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load deals')
      setDeals(data.deals || [])
      setTotal(data.pagination?.total || 0)
    } catch (e) {
      setError(e.message || String(e))
      notifyError(e, 'Failed to load deals')
    } finally {
      setLoading(false)
    }
  }

  // Initialize unitIdFilter from the URL (e.g., /deals?unitId=123)
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '')
      const unitIdParam = Number(params.get('unitId'))
      if (Number.isFinite(unitIdParam) && unitIdParam > 0) {
        setUnitIdFilter(unitIdParam)
      } else {
        setUnitIdFilter(null)
      }
    } catch {
      setUnitIdFilter(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, creatorEmail, reviewerEmail, approverEmail, unitType, startDate, endDate, minAmount, maxAmount, pageSize, sortBy, sortDir, unitIdFilter])

  useEffect(() => {
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Optional minimal callout for approver roles with pending queue items
  const [approverBanner, setApproverBanner] = useState({ show: false, url: '' })
  useEffect(() => {
    let mounted = true
    async function checkQueue() {
      try {
        const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
        const role = user?.role
        // Respect daily dismiss
        const todayKey = new Date().toISOString().slice(0, 10)
        const dismissed = localStorage.getItem('approver_queue_banner_dismissed')
        if (dismissed === todayKey) return

        let url = ''
        if (role === 'sales_manager') url = '/api/workflow/payment-plans/queue/sm'
        else if (role === 'financial_manager') url = '/api/workflow/payment-plans/queue/fm'
        else if (['ceo', 'vice_chairman', 'chairman', 'top_management'].includes(role)) url = '/api/workflow/payment-plans/queue/tm'
        if (!url) return
        const resp = await fetchWithAuth(`${API_URL}${url}`)
        const data = await resp.json()
        if (mounted && resp.ok) {
          const count = (data?.payment_plans || []).length
          if (count > 0) setApproverBanner({ show: true, url: '/deals/queues' })
        }
      } catch {}
    }
    checkQueue()
    return () => { mounted = false }
  }, [])

  async function handleDelete(deal) {
    const id = deal.id
    // optimistic remove
    const prevDeals = deals
    setDeals(d => d.filter(x => x.id !== id))
    setTotal(t => Math.max(0, t - 1))
    setDeletingIds(s => new Set([...s, id]))
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/deals/${id}`, { method: 'DELETE' })
      let msg = ''
      try {
        const j = await resp.json()
        msg = j?.error?.message || ''
      } catch {}
      if (!resp.ok) {
        // rollback
        setDeals(prevDeals)
        setTotal(t => t + 1)
        notifyError({ message: msg || 'Failed to delete deal' })
      } else {
        notifySuccess('Deal deleted')
      }
    } catch (e) {
      // rollback
      setDeals(prevDeals)
      setTotal(t => t + 1)
      notifyError(e, 'Failed to delete deal')
    } finally {
      setDeletingIds(s => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  const { setShow, setMessage } = useLoader()

  async function exportAllMatching() {
    // Build base query params from current filters and sorting
    const base = new URLSearchParams()
    if (status) base.set('status', status)
    if (search) base.set('search', search)
    if (creatorEmail) base.set('creatorEmail', creatorEmail)
    if (reviewerEmail) base.set('reviewerEmail', reviewerEmail)
    if (approverEmail) base.set('approverEmail', approverEmail)
    if (unitType) base.set('unitType', unitType)
    if (startDate) base.set('startDate', startDate)
    if (endDate) base.set('endDate', endDate)
    if (minAmount) base.set('minAmount', minAmount)
    if (maxAmount) base.set('maxAmount', maxAmount)
    if (sortBy) base.set('sortBy', sortBy)
    if (sortDir) base.set('sortDir', sortDir)

    const all = []
    const pageSizeForExport = 100 // API caps at 100
    let p = 1
    while (true) {
      const q = new URLSearchParams(base.toString())
      q.set('page', String(p))
      q.set('pageSize', String(pageSizeForExport))
      const resp = await fetchWithAuth(`${API_URL}/api/deals?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Export fetch failed')
      const batch = data.deals || []
      all.push(...batch)
      const totalCount = data.pagination?.total || 0
      const totalPagesExport = Math.max(1, Math.ceil(totalCount / pageSizeForExport))
      if (p >= totalPagesExport) break
      p += 1
    }
    return all
  }

  async function exportCSV() {
    try {
      setMessage('Generating report, please wait...')
      setShow(true)
      const rows = await exportAllMatching()
      const header = ['ID', 'Title', 'Amount', 'Status', 'Unit Type', 'Creator', 'Offer Date', 'First Payment Date', 'Created', 'Updated']
      const body = rows.map(d => ([
        d.id,
        d.title,
        Number(d.amount || 0).toFixed(2),
        d.status,
        d.unit_type || '',
        d.created_by_email || '',
        d?.details?.calculator?.inputs?.offerDate || '',
        d?.details?.calculator?.inputs?.firstPaymentDate || d?.details?.calculator?.inputs?.offerDate || '',
        d.created_at ? new Date(d.created_at).toISOString() : '',
        d.updated_at ? new Date(d.updated_at).toISOString() : ''
      ]))
      const out = [header, ...body]
      const csv = out.map(r => r.map(cell => {
        const s = String(cell ?? '')
        return /[\\\",\\n]/.test(s) ? `\"${s.replace(/\"/g, '\"\"')}\"` : s
      }).join(',')).join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.download = `deals_export_${ts}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notifySuccess('Export completed successfully.')
    } catch (e) {
      notifyError(e, 'Unable to export CSV.')
    } finally {
      setShow(false)
    }
  }

  async function exportXLSX() {
    try {
      setMessage('Generating report, please wait...')
      setShow(true)
      const rows = await exportAllMatching()
      const aoa = [
        ['ID', 'Title', 'Amount', 'Status', 'Unit Type', 'Creator', 'Offer Date', 'First Payment Date', 'Created', 'Updated'],
        ...rows.map(d => ([
          d.id,
          d.title,
          Number(d.amount || 0),
          d.status,
          d.unit_type || '',
          d.created_by_email || '',
          d?.details?.calculator?.inputs?.offerDate || '',
          d?.details?.calculator?.inputs?.firstPaymentDate || d?.details?.calculator?.inputs?.offerDate || '',
          d.created_at ? new Date(d.created_at).toLocaleString() : '',
          d.updated_at ? new Date(d.updated_at).toLocaleString() : ''
        ]))
      ]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [
        { wch: 6 },   // ID
        { wch: 28 },  // Title
        { wch: 14 },  // Amount
        { wch: 16 },  // Status
        { wch: 18 },  // Unit Type
        { wch: 28 },  // Creator
        { wch: 16 },  // Offer Date
        { wch: 20 },  // First Payment Date
        { wch: 22 },  // Created
        { wch: 22 },  // Updated
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Deals')
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.download = `deals_export_${ts}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notifySuccess('Export completed successfully.')
    } catch (e) {
      notifyError(e, 'Unable to export Excel.')
    } finally {
      setShow(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-display font-bold text-primary tracking-wide">All Deals</h2>
           <p className="text-sm text-gray-500 mt-1">Manage and track all sales proposals.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <a href="/deals/inventory" className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
             <span className="material-symbols-outlined text-[20px] mr-2">apartment</span>
             Browse Inventory
          </a>
          <a href="/deals/create" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90">
             <span className="material-symbols-outlined text-[20px] mr-2">add_circle</span>
             Create Offer
          </a>
          {(() => {
            try {
              const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
              if (['sales_manager','property_consultant','financial_manager'].includes(u?.role)) {
                return (
                    <a href="/deals/block-requests" className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                        <span className="material-symbols-outlined text-[20px] mr-2">block</span>
                        Block Requests
                    </a>
                )
              }
            } catch {}
            return null
          })()}
        </div>
      </div>

      {unitIdFilter && (
        <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
          <div className="flex">
            <div className="flex-shrink-0">
               <span className="material-symbols-outlined text-amber-500">filter_list</span>
            </div>
            <div className="ml-3 flex-1 md:flex md:justify-between">
              <p className="text-sm text-amber-700">
                Showing deals created for <strong>unit_id = {unitIdFilter}</strong>. Other filters are ignored while this view is active.
              </p>
              <p className="mt-3 text-sm md:mt-0 md:ml-6">
                <button
                  type="button"
                  onClick={() => {
                    setUnitIdFilter(null)
                    navigate('/deals', { replace: true })
                  }}
                  className="whitespace-nowrap font-medium text-amber-700 hover:text-amber-600"
                >
                  Clear unit filter <span aria-hidden="true">&rarr;</span>
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {approverBanner.show && (
        <div className="rounded-md bg-orange-50 p-4 border border-orange-200 shadow-sm animate-fade-in">
          <div className="flex">
            <div className="flex-shrink-0">
               <span className="material-symbols-outlined text-orange-500">notifications_active</span>
            </div>
            <div className="ml-3 flex-1 md:flex md:justify-between">
              <p className="text-sm text-orange-800">
                You have pending approvals in your queue.
              </p>
              <div className="mt-3 flex gap-4 md:mt-0 md:ml-6">
                 <a href={approverBanner.url} className="whitespace-nowrap font-medium text-orange-800 hover:text-orange-900">
                    Review Now <span aria-hidden="true">&rarr;</span>
                 </a>
                 <button
                    type="button"
                    onClick={() => {
                      const todayKey = new Date().toISOString().slice(0, 10)
                      localStorage.setItem('approver_queue_banner_dismissed', todayKey)
                      setApproverBanner({ show: false, url: '' })
                    }}
                    className="whitespace-nowrap text-sm text-orange-600 hover:text-orange-500"
                  >
                    Hide for today
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
             <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
            </select>
            <input placeholder="Search title…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading} />
            <input placeholder="Creator email…" value={creatorEmail} onChange={e => { setCreatorEmail(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading} />
            <input placeholder="Reviewer email…" value={reviewerEmail} onChange={e => { setReviewerEmail(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading} />
            <input placeholder="Approver email…" value={approverEmail} onChange={e => { setApproverEmail(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading} />
            <input placeholder="Unit type…" value={unitType} onChange={e => { setUnitType(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading} />
            
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading} />
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading} />
            <input type="number" placeholder="Min amount" value={minAmount} onChange={e => { setMinAmount(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading} />
            <input type="number" placeholder="Max amount" value={maxAmount} onChange={e => { setMaxAmount(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading} />
            
            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading}>
                <option value="id">Sort by ID</option>
                <option value="title">Sort by Title</option>
                <option value="amount">Sort by Amount</option>
                <option value="status">Sort by Status</option>
                <option value="created_at">Sort by Created</option>
                <option value="updated_at">Sort by Updated</option>
            </select>
            <select value={sortDir} onChange={e => { setSortDir(e.target.value); setPage(1) }} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm" disabled={loading}>
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
            </select>
          </div>
          <div className="flex justify-end mt-4">
             <LoadingButton 
                onClick={() => load(1)} 
                loading={loading} 
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
             >
                <span className="material-symbols-outlined text-[18px] mr-2">refresh</span>
                Refresh
             </LoadingButton>
          </div>
      </div>

      {error && (
         <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
               <div className="flex-shrink-0">
                  <span className="material-symbols-outlined text-red-400">error</span>
               </div>
               <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error loading deals</h3>
                  <div className="mt-2 text-sm text-red-700">
                     <p>{error}</p>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Table */}
      <div className="shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
                        <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Deal Status</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit Status</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Creator</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                    {loading && (
                        Array.from({ length: pageSize }).map((_, i) => (
                             <tr key={i} className="animate-pulse">
                                 <td className="py-4 pl-4 pr-3 sm:pl-6"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                                 <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                                 <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-24 ml-auto"></div></td>
                                 <td className="px-3 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                                 <td className="px-3 py-4"><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                                 <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                                 <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                 <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                                 <td className="px-3 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-8 ml-auto"></div></td>
                             </tr>
                        ))
                    )}
                    {!loading && deals.map((d) => {
                        const offerDate = d?.details?.calculator?.inputs?.offerDate || '';
                        const liveUnitStatus = d?.current_unit_status || '';
                        const liveAvailable = typeof d?.current_unit_available === 'boolean' ? d.current_unit_available : null;
                        let unitAvailability = '-';
                        if (liveUnitStatus) unitAvailability = liveUnitStatus;
                        else if (liveAvailable === true) unitAvailability = 'AVAILABLE';
                        else if (liveAvailable === false) unitAvailability = 'UNAVAILABLE';

                        let unitStatusClasses = "bg-gray-100 text-gray-800";
                        const ua = unitAvailability.toUpperCase();
                        if (ua === 'AVAILABLE') unitStatusClasses = "bg-green-100 text-green-800";
                        else if (ua === 'BLOCKED') unitStatusClasses = "bg-red-100 text-red-800";
                        else if (ua !== '-') unitStatusClasses = "bg-blue-100 text-blue-800";

                        let dealStatusClasses = "bg-gray-100 text-gray-800";
                        if (d.status === 'approved') dealStatusClasses = "bg-green-100 text-green-800";
                        else if (d.status === 'pending_approval') dealStatusClasses = "bg-blue-100 text-blue-800";
                        else if (d.status === 'rejected') dealStatusClasses = "bg-red-100 text-red-800";

                        return (
                            <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{d.id}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">{d.title}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right font-mono">{Number(d.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm">
                                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${dealStatusClasses}`}>
                                        {d.status}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm">
                                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${unitStatusClasses}`}>
                                        {unitAvailability}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{d.unit_type || '-'}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{d.created_by_email || '-'}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}</td>
                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 flex justify-end gap-2 items-center">
                                    <Link to={`/deals/${d.id}`} className="text-primary hover:text-primary/80 font-bold block mt-1">
                                        View
                                    </Link>
                                    {(user?.role === 'sales_manager' && d.status === 'pending_approval') && (
                                        <button
                                            onClick={async () => {
                                                if (!window.confirm(`Approve deal #${d.id}?`)) return
                                                try {
                                                    const resp = await fetchWithAuth(`${API_URL}/api/deals/${d.id}/approve`, { method: 'POST' })
                                                    if (!resp.ok) {
                                                        const data = await resp.json()
                                                        notifyError(data?.error?.message || 'Approval failed')
                                                    } else {
                                                        notifySuccess('Deal approved')
                                                        load(page)
                                                    }
                                                } catch (e) { notifyError(e, 'Approval failed') }
                                            }}
                                            className="text-green-600 hover:text-green-900 ml-2"
                                            title="Approve"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(d)}
                                        disabled={deletingIds.has(d.id)}
                                        className="text-red-600 hover:text-red-900 ml-2 opacity-60 hover:opacity-100"
                                        title="Delete"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                     {deals.length === 0 && !loading && (
                        <tr>
                            <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">
                                No deals match your criteria.
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
                  Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span> — <span className="font-medium">{total}</span> results
               </p>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => setPage(1)}
                    disabled={page === 1 || loading}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    First
                </button>
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Previous
                </button>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Next
                </button>
                <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages || loading}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Last
                </button>

                <div className="ml-4 flex gap-2">
                     <LoadingButton onClick={exportCSV} loading={loading} disabled={total === 0} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
                        Export CSV
                     </LoadingButton>
                     <LoadingButton onClick={exportXLSX} loading={loading} disabled={total === 0} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
                        Export Excel
                     </LoadingButton>
                </div>
            </div>
         </div>
      </div>
    </div>
  )
}