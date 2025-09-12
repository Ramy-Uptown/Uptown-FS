import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function CommissionsReport() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')

  const [sales, setSales] = useState([])
  const [policies, setPolicies] = useState([])

  const [filters, setFilters] = useState({ sales_person_id: '', policy_id: '', startDate: '', endDate: '' })

  useEffect(() => {
    async function loadFilters() {
      try {
        const [sres, pres] = await Promise.all([
          fetchWithAuth(`${API_URL}/api/sales?page=1&pageSize=200`).then(r => r.json()),
          fetchWithAuth(`${API_URL}/api/commission-policies?page=1&pageSize=100`).then(r => r.json())
        ])
        if (sres?.sales) setSales(sres.sales)
        if (pres?.policies) setPolicies(pres.policies)
      } catch {}
    }
    loadFilters()
  }, [])

  async function load() {
    try {
      setError('')
      const q = new URLSearchParams()
      if (filters.sales_person_id) q.set('sales_person_id', filters.sales_person_id)
      if (filters.policy_id) q.set('policy_id', filters.policy_id)
      if (filters.startDate) q.set('startDate', filters.startDate)
      if (filters.endDate) q.set('endDate', filters.endDate)
      const resp = await fetchWithAuth(`${API_URL}/api/commissions/report?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load report')
      setRows(data.commissions || [])
      setTotal(Number(data.total || 0))
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Commissions Report</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
        <select value={filters.sales_person_id} onChange={e => setFilters(s => ({ ...s, sales_person_id: e.target.value }))} style={ctrl}>
          <option value="">All sales</option>
          {sales.map(s => <option key={s.id} value={s.id}>{s.name} {s.email ? `(${s.email})` : ''}</option>)}
        </select>
        <select value={filters.policy_id} onChange={e => setFilters(s => ({ ...s, policy_id: e.target.value }))} style={ctrl}>
          <option value="">All policies</option>
          {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={filters.startDate} onChange={e => setFilters(s => ({ ...s, startDate: e.target.value }))} style={ctrl} />
        <input type="date" value={filters.endDate} onChange={e => setFilters(s => ({ ...s, endDate: e.target.value }))} style={ctrl} />
        <button onClick={load} style={btn}>Apply</button>
        <div />
      </div>

      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}

      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Deal</th>
              <th style={th}>Sales</th>
              <th style={th}>Policy</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>Calculated At</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.deal_title || r.deal_id}</td>
                <td style={td}>{r.sales_name || r.sales_person_id}</td>
                <td style={td}>{r.policy_name || r.policy_id}</td>
                <td style={{ ...td, textAlign: 'right' }}>{Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={td}>{r.calculated_at ? new Date(r.calculated_at).toLocaleString() : ''}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td style={td} colSpan={6}>No results.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ ...td, textAlign: 'right', fontWeight: 700 }}>Total</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td style={td}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }
const ctrl = { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6' }
const btn = { marginLeft: 6, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }