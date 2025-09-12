import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, ctrl, btn, btnPrimary, tableWrap, table, pageContainer, pageTitle, metaText, errorText } from '../lib/ui.js'
import BrandHeader from '../lib/BrandHeader.jsx'

export default function Units() {
  const [units, setUnits] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // form state
  const [form, setForm] = useState({ code: '', description: '', unit_type: '', base_price: '', currency: 'EGP' })
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
      const resp = await fetchWithAuth(`${API_URL}/api/units?${q.toString()}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load units')
      setUnits(data.units || [])
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
    setForm({ code: '', description: '', unit_type: '', base_price: '', currency: 'EGP' })
    setEditingId(0)
  }

  async function saveUnit(e) {
    e && e.preventDefault()
    try {
      setSaving(true)
      const body = { ...form, base_price: Number(form.base_price) || 0, currency: (form.currency || 'EGP').toUpperCase() }
      let resp
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
      resetForm()
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  async function edit(u) {
    setEditingId(u.id)
    setForm({
      code: u.code || '',
      description: u.description || '',
      unit_type: u.unit_type || '',
      base_price: String(u.base_price ?? ''),
      currency: u.currency || 'EGP'
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(id) {
    if (!confirm('Delete this unit?')) return
    const resp = await fetchWithAuth(`${API_URL}/api/units/${id}`, { method: 'DELETE' })
    const data = await resp.json()
    if (!resp.ok) return alert(data?.error?.message || 'Delete failed')
    await load()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleLogout = async () => {
    try {
      const rt = localStorage.getItem('refresh_token')
      if (rt) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt })
        }).catch(() => {})
      }
    } finally {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_user')
      window.location.href = '/login'
    }
  }

  return (
    <div>
      <BrandHeader onLogout={handleLogout} />
      <div style={pageContainer}>
        <h2 style={pageTitle}>Units Catalog</h2>

        <form onSubmit={saveUnit} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
          <input placeholder="Code" value={form.code} onChange={e => setForm(s => ({ ...s, code: e.target.value }))} style={ctrl} required />
          <input placeholder="Description" value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} style={ctrl} />
          <input placeholder="Unit Type" value={form.unit_type} onChange={e => setForm(s => ({ ...s, unit_type: e.target.value }))} style={ctrl} />
          <input type="number" placeholder="Base Price" value={form.base_price} onChange={e => setForm(s => ({ ...s, base_price: e.target.value }))} style={ctrl} />
          <select value={form.currency} onChange={e => setForm(s => ({ ...s, currency: e.target.value }))} style={ctrl}>
            <option value="EGP">EGP</option>
            <option value="USD">USD</option>
            <option value="SAR">SAR</option>
            <option value="EUR">EUR</option>
            <option value="AED">AED</option>
            <option value="KWD">KWD</option>
          </select>
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

        {error ? <p style={errorText}>{error}</p> : null}

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Code</th>
                <th style={th}>Description</th>
                <th style={th}>Unit Type</th>
                <th style={th}>Base Price</th>
                <th style={th}>Currency</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map(u => (
                <tr key={u.id}>
                  <td style={td}>{u.id}</td>
                  <td style={td}>{u.code}</td>
                  <td style={td}>{u.description || ''}</td>
                  <td style={td}>{u.unit_type || ''}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{Number(u.base_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style={td}>{u.currency}</td>
                  <td style={td}>
                    <button onClick={() => edit(u)} style={btn}>Edit</button>
                    <button onClick={() => remove(u.id)} style={btn}>Delete</button>
                  </td>
                </tr>
              ))}
              {units.length === 0 && !loading && (
                <tr>
                  <td style={td} colSpan={7}>No units.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={metaText}>
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))} — {total} total
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={btn}>First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={btn}>Prev</button>
            <button onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(total / pageSize)), p + 1))} disabled={page >= Math.max(1, Math.ceil(total / pageSize))} style={btn}>Next</button>
            <button onClick={() => setPage(Math.max(1, Math.ceil(total / pageSize)))} disabled={page >= Math.max(1, Math.ceil(total / pageSize))} style={btn}>Last</button>
          </div>
        </div>
      </div>
    </div>
  )
}

