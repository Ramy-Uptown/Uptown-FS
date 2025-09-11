import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function Users() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(0)
  const me = JSON.parse(localStorage.getItem('auth_user') || '{}')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load users')
      setUsers(data.users || [])
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  async function changeRole(id, role) {
    setBusyId(id)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/auth/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to update role')
      await load()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusyId(0)
    }
  }

  const roleOptions = [
    'user',
    'admin',
    'superadmin',
    'manager',
    'sales_manager',
    'property_consultant',
    'financial_manager',
    'financial_admin',
    'contract_manager',
    'contract_person',
    'chairman',
    'vice_chairman',
    'ceo'
  ]

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Users</h2>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      <div style={{ overflow: 'auto', border: '1px solid #e6eaf0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>Created</th>
              <th style={th}>Updated</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={td}>{u.id}</td>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.role}</td>
                <td style={td}>{u.created_at ? new Date(u.created_at).toLocaleString() : ''}</td>
                <td style={td}>{u.updated_at ? new Date(u.updated_at).toLocaleString() : ''}</td>
                <td style={td}>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    disabled={busyId === u.id || me.id === u.id}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d9e6' }}
                  >
                    {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td style={td} colSpan={6}>No users.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
        Note: You cannot change your own role from this screen.
      </p>
    </div>
  )
}

const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }