import React from 'react'
import { Link, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Dashboard from './Dashboard.jsx'
import CreateDeal from './CreateDeal.jsx'
import Approvals from './Approvals.jsx'
import DealDetail from './DealDetail.jsx'
import BrandHeader from '../lib/BrandHeader.jsx'

const BRAND = {
  primary: '#A97E34',
  primaryDark: '#8B672C',
  tintBg: '#f6efe3',
  tintBorder: '#ead9bd'
}

function RoleAwareNav() {
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const role = user?.role || 'user'
  const loc = useLocation()
  const linkStyle = (path) => ({
    padding: '8px 12px',
    borderRadius: 8,
    textDecoration: 'none',
    color: loc.pathname.startsWith(path) ? '#fff' : '#1f2937',
    background: loc.pathname.startsWith(path) ? BRAND.primary : BRAND.tintBg,
    border: `1px solid ${loc.pathname.startsWith(path) ? BRAND.primaryDark : BRAND.tintBorder}`
  })

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <Link to="/deals" style={linkStyle('/deals')}>Dashboard</Link>
      {role !== 'manager' && role !== 'admin' && (
        <Link to="/deals/create" style={linkStyle('/deals/create')}>Create Deal</Link>
      )}
      {(role === 'manager' || role === 'admin') && (
        <Link to="/deals/approvals" style={linkStyle('/deals/approvals')}>Approvals</Link>
      )}
      {(role === 'admin') && (
        <>
          <Link to="/admin/users" style={linkStyle('/admin/users')}>Users</Link>
          <Link to="/admin/units" style={linkStyle('/admin/units')}>Units</Link>
          <Link to="/admin/sales" style={linkStyle('/admin/sales')}>Sales Team</Link>
          <Link to="/admin/commission-policies" style={linkStyle('/admin/commission-policies')}>Commission Policies</Link>
          <Link to="/admin/commissions" style={linkStyle('/admin/commissions')}>Commissions</Link>
        </>
      )}
      <Link to="/calculator" style={linkStyle('/calculator')}>Calculator</Link>
    </div>
  )
}

export default function DealsApp() {
  const handleLogout = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
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
      <BrandHeader title={import.meta.env.VITE_APP_TITLE || 'Uptown Financial System'} onLogout={handleLogout} />
      <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
        <RoleAwareNav />

        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="create" element={<CreateDeal />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path=":id" element={<DealDetail />} />
          <Route path="*" element={<Navigate to="/deals" replace />} />
        </Routes>
      </div>
    </div>
  )
}