import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function Dashboard() {
  const [deals, setDeals] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setError('')
        const resp = await fetchWithAuth(`${API_URL}/api/deals`)
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load deals')
        setDeals(data.deals || [])
      } catch (e) {
        setError(e.message || String(e))
      }
    }
    load()
  }, [])

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>All Deals</h2>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Title</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
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
                <td style={td}>{d.created_by_email || '-'}</td>
                <td style={td}>{d.created_at ? new Date(d.created_at).toLocaleString() : ''}</td>
                <td style={td}>
                  <Link to={`/deals/${d.id}`} style={{ textDecoration: 'none', color: '#1f6feb' }}>View</Link>
                </td>
              </tr>
            ))}
            {deals.length === 0 && (
              <tr>
                <td style={td} colSpan={7}>No deals yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }