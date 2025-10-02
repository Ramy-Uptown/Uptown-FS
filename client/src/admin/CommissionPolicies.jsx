import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { th, td, ctrl, btn, btnPrimary, tableWrap, table, pageContainer, pageTitle, errorText } from '../lib/ui.js'
import BrandHeader from '../lib/BrandHeader.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function CommissionPolicies() {
  const [list, setList] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rowLoading, setRowLoading] = useState({})
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ name: '', description: '', rules: '{ "type": "percentage", "rate": 2.5 }', active: true })
  const [editingId, setEditingId] = useState(0)

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
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to load policies')
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
      notifySuccess(editingId ? 'Commission policy updated successfully.' : 'Commission policy created successfully.')
      resetForm()
      await load()
    } catch (e) {
      notifyError(e, 'Save failed')
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
    const key = `delete:${id}`
    try {
      setRowLoading(s => ({ ...s, [key]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/commission-policies/${id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Delete failed')
      notifySuccess('Commission policy deleted successfully.')
      await load()
    } catch (e) {
      notifyError(e, 'Delete failed')
    } finally {
      setRowLoading(s => ({ ...s, [key]: false }))
    }
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
        <h2 style={pageTitle}>Commission Policies</h2>

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
            <LoadingButton type="submit" loading={saving} variant="primary">{saving ? 'Saving…' : (editingId ? 'Update' : 'Create')}</LoadingButton>
            {editingId ? <LoadingButton type="button" onClick={resetForm}>Cancel</LoadingButton> : null}
          </div>
        </form>

        {error ? <p style={errorText}>{error}</p> : null}

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
              {loading && (
                <>
                  {Array.from({ length: pageSize }).map((_, i) => (
                    <SkeletonRow key={i} widths={['sm','lg','sm','lg','lg']} tdStyle={td} />
                  ))}
                </>
              )}
              {!loading && list.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.active ? 'Yes' : 'No'}</td>
                  <td style={td}>{r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td>
                  <td style={{ ...td, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <LoadingButton onClick={() => edit(r)}>Edit</LoadingButton>
                    <LoadingButton onClick={() => remove(r.id)} loading={rowLoading[`delete:${r.id}`]}>Delete</LoadingButton>
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
            <LoadingButton onClick={() => setPage(1)} disabled={page === 1 || loading}>First</LoadingButton>
            <LoadingButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>Prev</LoadingButton>
            <LoadingButton onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>Next</LoadingButton>
            <LoadingButton onClick={() => setPage(totalPages)} disabled={page === totalPages || loading}>Last</LoadingButton>
          </div>
        </div>
      </div>
    </div>
  )
}

