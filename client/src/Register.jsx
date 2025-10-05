import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import BrandHeader from './lib/BrandHeader.jsx'
import { notifyError, notifySuccess } from './lib/notifications.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const BRAND = { primary: '#A97E34' }

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const resp = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await resp.json()
      if (!resp.ok) {
        notifyError(data || { message: 'Registration failed' })
        return
      }
      const access = data.accessToken || data.token
      if (access) localStorage.setItem('auth_token', access)
      if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken)
      localStorage.setItem('auth_user', JSON.stringify(data.user))
      notifySuccess('Account created')
      navigate('/')
    } catch (e) {
      notifyError(e, 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <BrandHeader />
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'grid', placeItems: 'center', background: '#f7f9fb' }}>
        <form onSubmit={onSubmit} style={{ background: '#fff', border: '1px solid #e6eaf0', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 2px 6px rgba(21,24,28,0.04)' }}>
          <h2 style={{ marginTop: 0 }}>Register</h2>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee' }} />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${BRAND.primary}`, background: BRAND.primary, color: '#fff', fontWeight: 600, width: '100%' }}>
            {loading ? 'Registering...' : 'Register'}
          </button>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <small>
              Already have an account? <Link to="/login">Login</Link>
            </small>
          </div>
        </form>
      </div>
    </div>
  )
}