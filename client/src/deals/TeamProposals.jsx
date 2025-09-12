import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function TeamProposals() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/payment-plans/team`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load team proposals')
      setRows(data.payment_plans || [])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2>Team Proposals</h2>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Deal</th>
              <th style={th}>Creator</th>
              <th style={th}>Status</th>
              <th style={th}>Version</th>
              <th style={th}>Accepted</th>
              <th style={th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.deal_id}</td>
                <td style={td}>{r.created_by || ''}</td>
                <td style={td}>{r.status}</td>
                <td style={td}>{r.version || 1}</td>
                <td style={td}>{r.accepted ? 'Yes' : 'No'}</td>
                <td style={td}>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td style={td} colSpan={7}>No team proposals found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }