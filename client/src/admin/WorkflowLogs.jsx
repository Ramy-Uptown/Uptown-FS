import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import * as XLSX from 'xlsx'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import { useLoader } from '../lib/loaderContext.jsx'

export default function WorkflowLogs() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [type, setType] = useState('')
  const [consultantId, setConsultantId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')

  async function load() {
    try {
      setLoading(true)
      setError('')
      const q = new URLSearchParams()
      if (startDate) q.set('startDate', startDate)
      if (endDate) q.set('endDate', endDate)
      if (type) q.set('type', type)
      if (consultantId) q.set('consultant_id', consultantId)
      if (managerId) q.set('manager_id', managerId)
      const resp = await fetchWithAuth(`${API_URL}/api/reports/workflow-logs?${q.toString()}`)
      const j = await resp.json()
      if (!resp.ok) throw new Error(j?.error?.message || 'Failed to load report')
      setData(j)
      notifySuccess('Report loaded successfully.')
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const { setShow, setMessage } = useLoader()

  function exportXLSX() {
    if (!data) return
    try {
      setMessage('Generating report, please wait...')
      setShow(true)

      const wb = XLSX.utils.book_new()

      const makeSheet = (rows, headers) => {
        const aoa = [headers.map(h => h.label), ...rows.map(r => headers.map(h => r[h.key]))]
        const ws = XLSX.utils.aoa_to_sheet(aoa)
        ws['!cols'] = headers.map(() => ({ wch: 16 }))
        return ws
      }

      const offerHeaders = [
        { key: 'id', label: 'ID' },
        { key: 'deal_id', label: 'Deal ID' },
        { key: 'deal_title', label: 'Deal Title' },
        { key: 'unit_id', label: 'Unit ID' },
        { key: 'unit_code', label: 'Unit Code' },
        { key: 'unit_type', label: 'Unit Type' },
        { key: 'status', label: 'Status' },
        { key: 'version', label: 'Version' },
        { key: 'accepted', label: 'Accepted' },
        { key: 'created_by', label: 'Consultant ID' },
        { key: 'created_by_email', label: 'Consultant Email' },
        { key: 'manager_user_id', label: 'Manager ID' },
        { key: 'manager_email', label: 'Manager Email' },
        { key: 'created_at', label: 'Created At' },
        { key: 'total_nominal', label: 'Total Nominal' }
      ]
      const resHeaders = [
        { key: 'id', label: 'ID' },
        { key: 'payment_plan_id', label: 'Offer ID' },
        { key: 'unit_id', label: 'Unit ID' },
        { key: 'unit_code', label: 'Unit Code' },
        { key: 'unit_type', label: 'Unit Type' },
        { key: 'status', label: 'Status' },
        { key: 'created_by', label: 'Consultant ID' },
        { key: 'created_by_email', label: 'Consultant Email' },
        { key: 'manager_user_id', label: 'Manager ID' },
        { key: 'manager_email', label: 'Manager Email' },
        { key: 'created_at', label: 'Created At' },
        { key: 'total_nominal', label: 'Total Nominal' }
      ]
      const conHeaders = [
        { key: 'id', label: 'ID' },
        { key: 'reservation_form_id', label: 'Reservation ID' },
        { key: 'unit_id', label: 'Unit ID' },
        { key: 'unit_code', label: 'Unit Code' },
        { key: 'unit_type', label: 'Unit Type' },
        { key: 'status', label: 'Status' },
        { key: 'created_by', label: 'Consultant ID' },
        { key: 'created_by_email', label: 'Consultant Email' },
        { key: 'manager_user_id', label: 'Manager ID' },
        { key: 'manager_email', label: 'Manager Email' },
        { key: 'created_at', label: 'Created At' },
        { key: 'total_nominal', label: 'Total Nominal' }
      ]

      const offers = (data.offers?.rows || []).map(r => ({
        ...r,
        created_at: r.created_at ? new Date(r.created_at).toLocaleString() : ''
      }))
      const reservations = (data.reservations?.rows || []).map(r => ({
        ...r,
        created_at: r.created_at ? new Date(r.created_at).toLocaleString() : ''
      }))
      const contracts = (data.contracts?.rows || []).map(r => ({
        ...r,
        created_at: r.created_at ? new Date(r.created_at).toLocaleString() : ''
      }))

      XLSX.utils.book_append_sheet(wb, makeSheet(offers, offerHeaders), 'Offers')
      XLSX.utils.book_append_sheet(wb, makeSheet(reservations, resHeaders), 'Reservations')
      XLSX.utils.book_append_sheet(wb, makeSheet(contracts, conHeaders), 'Contracts')

      const offersTotal = (data.offers?.rows || []).reduce(
        (s, r) => s + (Number(r.total_nominal) || 0),
        0
      )
      const reservationsTotal = (data.reservations?.rows || []).reduce(
        (s, r) => s + (Number(r.total_nominal) || 0),
        0
      )
      const contractsTotal = (data.contracts?.rows || []).reduce(
        (s, r) => s + (Number(r.total_nominal) || 0),
        0
      )

      const offersCount = offers.length
      const reservationsCount = reservations.length
      const contractsCount = contracts.length

      const sumSheet = XLSX.utils.aoa_to_sheet([
        ['Type', 'Count', 'Total Value'],
        ['Offers', offersCount, offersTotal],
        ['Reservations', reservationsCount, reservationsTotal],
        ['Contracts', contractsCount, contractsTotal]
      ])
      sumSheet['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, sumSheet, 'Totals')

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.download = `workflow_logs_${ts}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notifySuccess('Export completed successfully.')
    } catch (e) {
      notifyError(e, 'Export failed')
    } finally {
      setShow(false)
    }
  }

  function exportCSV() {
    if (!data) return
    try {
      setMessage('Generating report, please wait...')
      setShow(true)
      const ts = new Date().toISOString().replace(/[:.]/g, '-')

      const makeCSV = (rows) => {
        if (!rows || rows.length === 0) return ''
        const headers = Object.keys(rows[0])
        const body = rows.map(r => headers.map(h => {
          const v = r[h]
          const s = v == null ? '' : String(v)
          return /[\",\n]/.test(s) ? `\"${s.replace(/\"/g, '\"\"')}\"` : s
        }).join(','))
        return [headers.join(','), ...body].join('\n')
      }

      const sections = [
        { name: 'offers', rows: data.offers?.rows || [] },
        { name: 'reservations', rows: data.reservations?.rows || [] },
        { name: 'contracts', rows: data.contracts?.rows || [] }
      ]
      sections.forEach(sec => {
        if (!sec.rows.length) return
        const csv = makeCSV(sec.rows)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `workflow_logs_${sec.name}_${ts}.csv`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      notifySuccess('Export completed successfully.')
    } catch (e) {
      notifyError(e, 'Export failed')
    } finally {
      setShow(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={user?.role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="w-full mx-auto space-y-6">

             <div className="flex items-center justify-between">
                <div>
                     <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Workflow Logs</h2>
                     <p className="text-sm text-gray-500 mt-1">Comprehensive system activity and transaction logs.</p>
                </div>
                 <div className="flex gap-2">
                     <LoadingButton 
                        onClick={exportXLSX} 
                        disabled={!data}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                    >
                         <span className="material-symbols-outlined text-sm mr-1">grid_on</span> Export XLSX
                     </LoadingButton>
                     <LoadingButton 
                        onClick={exportCSV} 
                        disabled={!data}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                    >
                         <span className="material-symbols-outlined text-sm mr-1">description</span> Export CSV
                     </LoadingButton>
                 </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-xs" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-xs" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Log Type</label>
                    <select value={type} onChange={e => setType(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-xs">
                        <option value="">All Types</option>
                        <option value="offers">Offers</option>
                        <option value="reservations">Reservations</option>
                        <option value="contracts">Contracts</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Consultant ID</label>
                    <input type="number" placeholder="User ID" value={consultantId} onChange={e => setConsultantId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-xs" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Manager ID</label>
                    <input type="number" placeholder="User ID" value={managerId} onChange={e => setManagerId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-xs" />
                </div>
                 <div className="flex items-end">
                     <LoadingButton onClick={load} loading={loading} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm">
                        Apply Filters
                     </LoadingButton>
                 </div>
            </div>

            {error ? <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div> : null}

            {data && (
                <div className="space-y-8">
                     <Section
                        title="Offers"
                        rows={data.offers?.rows}
                        total={data.offers?.total}
                        byStatus={data.offers?.byStatus}
                    />
                    <Section
                        title="Reservations"
                        rows={data.reservations?.rows}
                        total={data.reservations?.total}
                        byStatus={data.reservations?.byStatus}
                    />
                    <Section
                        title="Contracts"
                        rows={data.contracts?.rows}
                        total={data.contracts?.total}
                        byStatus={data.contracts?.byStatus}
                    />
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
                         <h3 className="text-lg font-medium text-gray-900 mb-4">Summary Totals</h3>
                         <SummaryFooter data={data} />
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  )
}

function Section({ title, rows, total, byStatus }) {
  const list = rows || []
  
  const breakdown =
    Array.isArray(byStatus) && byStatus.length
      ? byStatus
      : buildStatusBreakdown(list)

  // Fallback: recompute total from rows if API total is missing or zero but we have data.
  const computedTotal = list.reduce((s, r) => s + (Number(r.total_nominal) || 0), 0)
  const displayTotal = Number(total || 0) || computedTotal

  return (
    <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
             <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    Total: <span className="font-mono">{Number(displayTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {breakdown.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 justify-end">
                        {breakdown.map((b, idx) => (
                            <span key={b.status || idx}>
                                <span className="uppercase font-semibold text-gray-700">{b.status || 'unknown'}</span>: {b.count} <span className="text-gray-400">|</span> {formatTotal(b.total_nominal)}
                            </span>
                        ))}
                    </div>
                  )}
             </div>
        </div>

        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
                 <thead className="bg-gray-50">
                    <tr>
                         {list.length > 0 && Object.keys(list[0]).map(k => (
                             <th key={k} scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                                 {k.replace(/_/g, ' ')}
                             </th>
                         ))}
                         {list.length === 0 && <th className="px-3 py-3.5 text-left text-xs text-gray-500">No Data</th>}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200 bg-white">
                    {list.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            {Object.keys(r).map(k => (
                                <td key={k} className="whitespace-nowrap px-3 py-4 text-xs text-gray-600">
                                    {formatCell(k, r[k])}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {list.length === 0 && (
                        <tr><td className="px-3 py-8 text-center text-sm text-gray-500" colSpan="100%">No records found for this period.</td></tr>
                    )}
                 </tbody>
            </table>
        </div>
    </div>
  )
}

function buildStatusBreakdown(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const status = r.status || 'unknown'
    const existing = map.get(status) || { status, count: 0, total_nominal: 0 }
    existing.count += 1
    existing.total_nominal += Number(r.total_nominal) || 0
    map.set(status, existing)
  }
  return Array.from(map.values())
}

function SummaryFooter({ data }) {
  const offersRows = data.offers?.rows || []
  const reservationsRows = data.reservations?.rows || []
  const contractsRows = data.contracts?.rows || []

  const offersTotal = offersRows.reduce((s, r) => s + (Number(r.total_nominal) || 0), 0)
  const reservationsTotal = reservationsRows.reduce((s, r) => s + (Number(r.total_nominal) || 0), 0)
  const contractsTotal = contractsRows.reduce((s, r) => s + (Number(r.total_nominal) || 0), 0)

  const offersCount = offersRows.length
  const reservationsCount = reservationsRows.length
  const contractsCount = contractsRows.length

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
       <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Offers</div>
            <div className="text-2xl font-bold text-gray-900">{offersCount}</div>
            <div className="text-sm text-gray-600 mt-1 font-mono">{formatTotal(offersTotal)} <span className="text-xs text-gray-400">EGP</span></div>
       </div>
       <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reservations</div>
            <div className="text-2xl font-bold text-gray-900">{reservationsCount}</div>
            <div className="text-sm text-gray-600 mt-1 font-mono">{formatTotal(reservationsTotal)} <span className="text-xs text-gray-400">EGP</span></div>
       </div>
       <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contracts</div>
            <div className="text-2xl font-bold text-gray-900">{contractsCount}</div>
            <div className="text-sm text-gray-600 mt-1 font-mono">{formatTotal(contractsTotal)} <span className="text-xs text-gray-400">EGP</span></div>
       </div>
    </div>
  )
}

function formatTotal(v) {
  const n = Number(v) || 0
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCell(k, v) {
  if (k.includes('created_at') || k.includes('updated_at')) {
    return v ? new Date(v).toLocaleString() : ''
  }
  if (k.includes('total')) {
    return formatTotal(v)
  }
  return String(v ?? '')
}
