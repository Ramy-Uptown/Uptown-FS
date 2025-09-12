import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import * as XLSX from 'xlsx'
import { th, td, ctrl, btn } from '../lib/ui.js'

export default function WorkflowLogs() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [type, setType] = useState('')
  const [consultantId, setConsultantId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function exportXLSX() {
    if (!data) return
    const wb = XLSX.utils.book_new()

    const makeSheet = (rows, headers) => {
      const aoa = [headers.map(h => h.label), ...rows.map(r => headers.map(h => r[h.key]))]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = headers.map(() => ({ wch: 16 }))
      return ws
    }

    const offerHeaders = [
      { key: 'id', label: 'ID' },
      { key: 'deal_id', label: 'Deal' },
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

    const sumSheet = XLSX.utils.aoa_to_sheet([
      ['Section', 'Total'],
      ['Offers', Number(data.offers?.total || 0)],
      ['Reservations', Number(data.reservations?.total || 0)],
      ['Contracts', Number(data.contracts?.total || 0)],
      ['Grand Total', Number(data.grandTotal || 0)]
    ])
    sumSheet['!cols'] = [{ wch: 24 }, { wch: 18 }]
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
  }

  function exportCSV() {
    if (!data) return
    const ts = new Date().toISOString().replace(/[:.]/g, '-')

    const makeCSV = (rows) => {
      if (!rows || rows.length === 0) return ''
      const headers = Object.keys(rows[0])
      const body = rows.map(r => headers.map(h => {
        const v = r[h]
        const s = v == null ? '' : String(v)
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2>Workflow Logs</h2>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 12 }}>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={ctrl} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={ctrl} />
        <select value={type} onChange={e => setType(e.target.value)} style={ctrl}>
          <option value="">All Types</option>
          <option value="offers">Offers</option>
          <option value="reservations">Reservations</option>
          <option value="contracts">Contracts</option>
        </select>
        <input type="number" placeholder="Consultant User ID" value={consultantId} onChange={e => setConsultantId(e.target.value)} style={ctrl} />
        <input type="number" placeholder="Sales Manager User ID" value={managerId} onChange={e => setManagerId(e.target.value)} style={ctrl} />
        <div>
          <button onClick={load} disabled={loading} style={btn}>{loading ? 'Loading…' : 'Apply'}</button>
          <button onClick={exportXLSX} disabled={!data} style={btn}>Export XLSX</button>
          <button onClick={exportCSV} disabled={!data} style={btn}>Export CSV</button>
        </div>

      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}

      {data && (
        <>
          <Section title="Offers" rows={data.offers?.rows} total={data.offers?.total} />
          <Section title="Reservations" rows={data.reservations?.rows} total={data.reservations?.total} />
          <Section title="Contracts" rows={data.contracts?.rows} total={data.contracts?.total} />
          <div style={{ marginTop: 12, fontWeight: 700 }}>Grand Total: {Number(data.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </>
      )}
    </div>
  )
}

function Section({ title, rows, total }) {
  const list = rows || []
  const numCols = list.length > 0 ? Object.keys(list[0]).length : 1
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div style={{ fontWeight: 700 }}>Total: {Number(total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {list.length > 0 && Object.keys(list[0]).map(k => <th key={k} style={th}>{k}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((r, idx) => (
              <tr key={idx}>
                {Object.keys(r).map(k => <td key={k} style={td}>{formatCell(k, r[k])}</td>)}
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td style={{ ...td, textAlign: 'center' }} colSpan={numCols}>No records.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatCell(k, v) {
  if (k.includes('created_at') || k.includes('updated_at')) {
    return v ? new Date(v).toLocaleString() : ''
  }
  if (k.includes('total')) {
    const n = Number(v) || 0
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return String(v ?? '')
}

