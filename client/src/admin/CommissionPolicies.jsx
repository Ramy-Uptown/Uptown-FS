import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, ctrl, btn, btnPrimary, tableWrap, table } from '../lib/ui.js'

export default function CommissionPolicies() {
  const [list, setList] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({ name: '', description: '', rules: '{ "type": "percentage", "rate": 2.5 }', active: true })
  const [editingId, setEditingId] = useState(0)
  const [saving, setSaving] = useState(false)

  async function load(p = page) {
    try {
      setLoading(true)
      setError('')
      const q = new URLSearchParams()
      q.set('page', String(p))
      q.set('pageSize', String(pageSize))
      const resp = await fetchWithAuth(`${API_URL}/api/commission-policies?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load policies')
      setList(data.policies || [])
      setTotal(data.pagination?.total || 0)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [pageSize])
  useEffect(() => { load(page) }, [page])

  function resetForm() {
    setForm({ name: '', description: '', rules: '{ "type": "percentage", "rate": 2.5 }', active: true })
    setEditingId(0)
  }

  async function save(e) {
    e && e.preventDefault()
    try {
      setSaving(true)
      let rulesObj = {}
      try { rulesObj = JSON.parse(form.rules) } catch { throw new Error('Rules must be valid JSON') }
      const payload = { name: form.name, description: form.description, rules: rulesObj, active: !!form.active }
      let resp
      if (editingId) {
        resp = await fetchWithAuth(`${API_URL}/api/commission-policies/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        resp = await fetchWithAuth(`${API_URL}/api/commission-policies`, {
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

  function edit(row) {
    setEditingId(row.id)
    setForm({ name: row.name || '', description: row.description || '', rules: JSON.stringify(row.rules || {}, null, 2), active: !!row.active })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(id) {
    if (!confirm('Delete this policy?')) return
    const resp = await fetchWithAuth(`${API_URL}/api/commission-policies/${id}`, { method: 'DELETE' })
    const data = await resp.json()
    if (!resp.ok) return alert(data?.error?.message || 'Delete failed')
    await load()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Commission Policies</h2>

      <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
        <input placeholder="Name" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} style={ctrl} required />
        <input placeholder="Description" value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} style={ctrl} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={!!form.active} onChange={e => setForm(s => ({ ...s, active: e.target.checked }))} />
          Active
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 }}>Rules (JSON)</label>
          <textarea value={form.rules} onChange={e => setForm(s => ({ ...s, rules: e.target.value }))} rows={10} style={{ ...ctrl, fontFamily: 'monospace' }} />
        </div>
        <div>
          <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : (editingId ? 'Update' : 'Create')}</button>
          {editingId ? <button type="button" onClick={resetForm} style={btn}>Cancel</button> : null}
        </div>
      </form>

      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Name</th>
              <th style={th}>Active</th>
              <th style={th}>Updated</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.active ? 'Yes' : 'No'}</td>
                <td style={td}>{r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td>
                <td style={td}>
                  <button onClick={() => edit(r)} style={btn}>Edit</button>
                  <button onClick={() => remove(r.id)} style={btn}>Delete</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && (
              <tr>
                <td style={td} colSpan={5}>No policies.</td>
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
const ctrl = { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6', width: '100%' }
const btn = { marginLeft: 6, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }
const btnPrimary = { padding: '10px 14px', borderRadius: 10, border: '1px solid #1f6feb', background: '#1f6feb', color: '#fff', fontWeight: 600 }