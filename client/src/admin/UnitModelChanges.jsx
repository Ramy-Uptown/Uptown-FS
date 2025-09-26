import React, { useEffect, useState } from 'react'
import BrandHeader from '../lib/BrandHeader.jsx'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

function fmt(n) {
  const v = Number(n || 0)
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function yesNo(v, area) {
  if (v != null) return v ? 'Yes' : 'No'
  const a = Number(area)
  return Number.isFinite(a) && a > 0 ? 'Yes' : 'No'
}

export default function UnitModelChanges() {
  const [changes, setChanges] = useState([])
  const [status, setStatus] = useState('pending_approval')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rejectReason, setRejectReason] = useState({})
  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const role = me?.role
  const isTop = role === 'ceo' || role === 'chairman' || role === 'vice_chairman'
  const isFM = role === 'financial_manager'

  async function load() {
    try {
      setLoading(true); setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes?status=${encodeURIComponent(status)}`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load changes')
      setChanges(data.changes || [])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status])

  async function approveChange(id) {
    if (!isTop) return alert('Only Top Management can approve.')
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}/approve`, { method: 'PATCH' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Approve failed')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  async function rejectChange(id) {
    if (!isTop) return alert('Only Top Management can reject.')
    const reason = (rejectReason[id] || '').trim()
    if (!reason) return alert('Please provide a reason for rejection')
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Reject failed')
      setRejectReason(s => ({ ...s, [id]: '' }))
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  async function cancelChange(id, requestedBy) {
    if (!isFM) return
    if (requestedBy !== me?.id) return alert('You can only cancel your own requests.')
    if (!window.confirm('Cancel this pending request? This cannot be undone.')) return
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/changes/${id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Cancel failed')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    }
  }

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
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Unit Model Changes</h2>
          <div>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {error ? <p className="text-red-500 mt-2">{error}</p> : null}
        {loading ? <p className="text-gray-500 mt-2">Loading…</p> : null}

        <div className="overflow-x-auto mt-3">
          <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approved By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested At</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated At</th>
                {/* Key payload summary columns for better visual parity with pricing queue */}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area (m²)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orientation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Garden</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Garden Area</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roof</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roof Area</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Garage Area</th>
                {status === 'pending_approval' && (isTop || isFM) ? (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {changes.map(ch => {
                const p = ch.payload || {}
                const canCancel = status === 'pending_approval' && isFM && (ch.requested_by === me?.id)
                return (
                <tr key={ch.id}>
                  <td className="px-4 py-3">{ch.id}</td>
                  <td className="px-4 py-3">{ch.action}</td>
                  <td className="px-4 py-3">{ch.model_id || '—'}</td>
                  <td className="px-4 py-3">{ch.requested_by_email || ch.requested_by}</td>
                  <td className="px-4 py-3">{ch.approved_by_email || (ch.approved_by || '—')}</td>
                  <td className="px-4 py-3">{ch.reason || '—'}</td>
                  <td className="px-4 py-3">{ch.created_at ? new Date(ch.created_at).toLocaleString() : ''}</td>
                  <td className="px-4 py-3">{ch.updated_at ? new Date(ch.updated_at).toLocaleString() : ''}</td>

                  <td className="px-4 py-3">{p.model_name || '—'}</td>
                  <td className="px-4 py-3">{p.model_code || '—'}</td>
                  <td className="px-4 py-3">{p.area != null ? Number(p.area).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">{String(p.orientation || '').replace(/_/g, ' ') || '—'}</td>
                  <td className="px-4 py-3">{yesNo(p.has_garden, p.garden_area)}</td>
                  <td className="px-4 py-3">{p.garden_area != null ? Number(p.garden_area).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">{yesNo(p.has_roof, p.roof_area)}</td>
                  <td className="px-4 py-3">{p.roof_area != null ? Number(p.roof_area).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">{p.garage_area != null ? Number(p.garage_area).toLocaleString() : '—'}</td>

                  {status === 'pending_approval' && (isTop || canCancel) ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isTop ? (
                          <>
                            <button
                              onClick={() => approveChange(ch.id)}
                              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm"
                            >
                              Approve
                            </button>
                            <input
                              placeholder="Reason (required)"
                              value={rejectReason[ch.id] || ''}
                              onChange={e => setRejectReason(s => ({ ...s, [ch.id]: e.target.value }))}
                              className="px-3 py-2 border rounded-md"
                            />
                            <button
                              onClick={() => rejectChange(ch.id)}
                              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded text-sm"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {canCancel ? (
                          <button
                            onClick={() => cancelChange(ch.id, ch.requested_by)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-3 rounded text-sm"
                          >
                            Cancel Request
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              )})}
              {changes.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-3" colSpan={status === 'pending_approval' && (isTop || isFM) ? 18 : 17}>
                    No changes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-gray-500 text-sm">
          {isTop ? (
            <>Only CEO, Chairman, or Vice Chairman can approve or reject changes.</>
          ) : isFM ? (
            <>You may cancel your own pending requests. Approval is by Top Management.</>
          ) : (
            <>Read-only view.</>
          )}
        </div>
      </div>
    </div>
  )
}