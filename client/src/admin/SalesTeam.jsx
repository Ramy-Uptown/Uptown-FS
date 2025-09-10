import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function SalesTeam() {
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({ user_id: '', name: '', email: '', role: 'sales', active: true })
  const [editingId, setEditingId] = useState(0)
  const [saving, setSaving] = useState(false)

  async function load(p = page) {
    try {
      setLoading(true)
      setError('')
      const q = new URLSearchParams()
      if (search) q.set('search', search)
      q.set('page', String(p))
      q.set('pageSize', String(pageSize))
      const resp = await fetchWithAuth(`${API_URL}/api/sales?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load sales team')
      setList(data.sales || [])
      setTotal(data.pagination?.total || 0)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [search, pageSize])
  useEffect(() => { load(page) }, [page])

  function resetForm() {
    setForm({ user_id: '', name: '', email: '', role: 'sales', active: true })
    setEditingId(0)
  }

  async function save(e) {
    e && e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        user_id: form.user_id ? Number(form.user_id) : null,
        name: form.name,
        email: form.email,
        role: form.role,
        active: !!form.active
      }
      let resp
      if (editingId) {
        resp = await fetchWithAuth(`${API_URL}/api/sales/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        resp = await fetchWithAuth(`${API_URL}/api/sales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Save failed')
      resetForm()
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function edit(row) {
    setEditingId(row.id)
    setForm({ user_id: row.user_id || '', name: row.name || '', email: row.email || '', role: row.role || 'sales', active: !!row.active })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(id) {
    if (!confirm('Delete this sales person?')) return
    const resp = await fetchWithAuth(`${API_URL}/api/sales/${id}`, { method: 'DELETE' })
    const data = await resp.json()
    if (!resp.ok) return alert(data?.error?.message || 'Delete failed')
    await load()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Sales Team</h2>

      <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
        <input placeholder="User ID (optional)" value={form.user_id} onChange={e => setForm(s => ({ ...s, user_id: e.target.value }))} style={ctrl} />
        <input placeholder="Name" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} style={ctrl} required />
        <input placeholder="Email" value={form.email} onChange={e => setForm(s => ({ ...s, email: e.target.value }))} style={ctrl} />
        <select value={form.role} onChange={e => setForm(s => ({ ...s, role: e.target.value }))} style={ctrl}>
          <option value="sales">sales</option>
          <option value="senior_sales">senior_sales</option>
          <option value="manager">manager</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={!!form.active} onChange={e => setForm(s => ({ ...s, active: e.target.checked }))} />
          Active
        </label>
        <div>
          <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : (editingId ? 'Update' : 'Create')}</button>
          {editingId ? <button type="button" onClick={resetForm} style={btn}>Cancel</button> : null}
        </div>
      </form>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={ctrl} />
        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={ctrl}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}

      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>Active</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.email || ''}</td>
                <td style={td}>{r.role || ''}</td>
                <td style={td}>{r.active ? 'Yes' : 'No'}</td>
                <td style={td}>
                  <button onClick={() => edit(r)} style={btn}>Edit</button>
                  <button onClick={() => remove(r.id)} style={btn}>Delete</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && (
              <tr>
                <td style={td} colSpan={6}>No sales people.</td>
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
const btn = { marginLeft: 6, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }
const btnPrimary = { padding: '10px 14px', borderRadius: 10, border: '1px solid #1f6feb', background: '#1f6feb', color: '#fff', fontWeight: 600 }