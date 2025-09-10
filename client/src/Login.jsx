import React, { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const resp = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Login failed')
      }
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('auth_user', JSON.stringify(data.user))
      window.location.href = '/'
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7f9fb' }}>
      <form onSubmit={onSubmit} style={{ background: '#fff', border: '1px solid #e6eaf0', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 2px 6px rgba(21,24,28,0.04)' }}>
        <h2 style={{ marginTop: 0 }}>Login</h2>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee' }} />
        </div>
        {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
        <button type="submit" disabled={loading} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #1f6feb', background: '#1f6feb', color: '#fff', fontWeight: 600, width: '100%' }}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}