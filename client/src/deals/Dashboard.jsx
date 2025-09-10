import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

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

  async function load(p = page) {
    try {
      setLoading(true)
      setError('')
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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, creatorEmail, reviewerEmail, approverEmail, unitType, startDate, endDate, minAmount, maxAmount, pageSize, sortBy, sortDir])

  useEffect(() => {
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>All Deals</h2>
      <div style={{ display: 'grid', gap: 8, marginBottom: 12, gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={ctrl}>
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="pending_approval">pending_approval</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <input placeholder="Search title…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={ctrl} />
        <input placeholder="Creator email…" value={creatorEmail} onChange={e => { setCreatorEmail(e.target.value); setPage(1) }} style={ctrl} />
        <input placeholder="Reviewer email…" value={reviewerEmail} onChange={e => { setReviewerEmail(e.target.value); setPage(1) }} style={ctrl} />
        <input placeholder="Approver email…" value={approverEmail} onChange={e => { setApproverEmail(e.target.value); setPage(1) }} style={ctrl} />
        <input placeholder="Unit type…" value={unitType} onChange={e => { setUnitType(e.target.value); setPage(1) }} style={ctrl} />
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} style={ctrl} />
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} style={ctrl} />
        <input type="number" placeholder="Min amount" value={minAmount} onChange={e => { setMinAmount(e.target.value); setPage(1) }} style={ctrl} />
        <input type="number" placeholder="Max amount" value={maxAmount} onChange={e => { setMaxAmount(e.target.value); setPage(1) }} style={ctrl} />
        <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }} style={ctrl}>
          <option value="id">Sort by id</option>
          <option value="title">Sort by title</option>
          <option value="amount">Sort by amount</option>
          <option value="status">Sort by status</option>
          <option value="created_at">Sort by created</option>
          <option value="updated_at">Sort by updated</option>
        </select>
        <select value={sortDir} onChange={e => { setSortDir(e.target.value); setPage(1) }} style={ctrl}>
          <option value="desc">desc</option>
          <option value="asc">asc</option>
        </select>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={ctrl}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <button onClick={() => load(1)} disabled={loading} style={btn}>Refresh</button>
      </div>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Title</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
              <th style={th}>Unit Type</th>
              <th style={th}>Creator</th>
              <th style={th}>Created</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map(d => (
              <tr key={d.id}>
                <td style={td}>{d.id}</td>
                <td style={td}>{d.title}</td>
                <td style={{ ...td, textAlign: 'right' }}>{Number(d.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={td}>{d.status}</td>
                <td style={td}>{d.unit_type || '-'}</td>
                <td style={td}>{d.created_by_email || '-'}</td>
                <td style={td}>{d.created_at ? new Date(d.created_at).toLocaleString() : ''}</td>
                <td style={td}>
                  <Link to={`/deals/${d.id}`} style={{ textDecoration: 'none', color: '#1f6feb' }}>View</Link>
                </td>
              </tr>
            ))}
            {deals.length === 0 && !loading && (
              <tr>
                <td style={td} colSpan={8}>No deals match your criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ color: '#64748b', fontSize: 12 }}>
          Page {page} of {totalPages} — {total} total
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={btn}>First</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={btn}>Prev</button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={btn}>Next</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={btn}>Last</button>
        </div>
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }
const ctrl = { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6' }
const btn = { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }