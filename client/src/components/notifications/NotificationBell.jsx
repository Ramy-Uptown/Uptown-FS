import React, { useEffect, useState, useRef } from 'react'
import { fetchWithAuth } from '../../lib/apiClient.js'

// Get action URL based on notification type and ref_table/ref_id
function getActionUrl(notification) {
  const { type, ref_table, ref_id } = notification || {}
  const t = String(type || '').toLowerCase()

  // Block-related notifications
  if (t.includes('block') || t.includes('unblock')) {
    return '/deals/block-requests'
  }

  // Inventory drafts
  if (t === 'inventory_unit_draft') {
    return '/admin/inventory-drafts'
  }

  // Inventory changes
  if (t === 'unit_inventory_change_request') {
    return '/admin/inventory-changes'
  }

  // Model changes
  if (t === 'unit_model_change_rejected' || t.includes('unit_model')) {
    return '/admin/unit-model-changes'
  }

  // Hold-related notifications
  if (t.includes('hold')) {
    // For CEO/TM users, go to hold-approvals; otherwise holds
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
    const tmRoles = ['ceo', 'chairman', 'vice_chairman', 'top_management', 'contract_manager', 'sales_manager']
    if (tmRoles.includes(user?.role)) {
      return '/admin/hold-approvals'
    }
    return '/admin/holds'
  }

  // Pricing-related
  if (t.includes('pricing') || t.includes('price')) {
    return '/admin/standard-pricing'
  }

  // Threshold-related
  if (t.includes('threshold')) {
    return '/admin/payment-thresholds'
  }

  // Offer/deal-related
  if (t.includes('offer') || t.includes('deal')) {
    if (ref_table === 'deals' && ref_id) {
      return `/deals/${ref_id}`
    }
    return '/deals/queues'
  }

  // Reservation-related
  if (t.includes('reservation')) {
    if (ref_id) {
      return `/reservation-forms/${ref_id}`
    }
    return '/deals/queues'
  }

  // Contract-related
  if (t.includes('contract')) {
    if (ref_id) {
      return `/contracts/${ref_id}`
    }
    return '/contracts'
  }

  // Default: go to notifications full page
  return '/notifications'
}

export default function NotificationBell() {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  async function loadCount() {
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/notifications/unread-count`)
      const data = await resp.json().catch(() => ({}))
      if (resp.ok) {
        const next = Number(data?.count || 0)
        setCount(next)
      }
    } catch {}
  }

  async function loadList() {
    try {
      setLoading(true)
      const resp = await fetchWithAuth(`${API_URL}/api/notifications`)
      const data = await resp.json().catch(() => ({}))
      if (resp.ok) setItems(Array.isArray(data?.notifications) ? data.notifications : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCount()
    const t = setInterval(loadCount, 60000) // poll every 60s to reduce noise
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      await loadList()
    }
  }

  async function markAllRead() {
    try {
      await fetchWithAuth(`${API_URL}/api/notifications/mark-all-read`, { method: 'PATCH' })
      setItems(it => it.map(n => ({ ...n, is_read: true })))
      setCount(0)
    } catch {}
  }

  async function markRead(id, e) {
    if (e) e.stopPropagation()
    try {
      await fetchWithAuth(`${API_URL}/api/notifications/${id}/read`, { method: 'PATCH' })
      setItems(it => it.map(n => n.id === id ? { ...n, is_read: true } : n))
      setCount(c => Math.max(0, c - 1))
    } catch {}
  }

  function handleNotificationClick(n) {
    const url = getActionUrl(n)
    setOpen(false)
    window.location.href = url
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={toggleOpen} style={bellBtnStyle} title="Notifications">
        <span>🔔</span>
        {count > 0 && <span style={badgeStyle}>{count}</span>}
      </button>
      {open && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
            <strong>Notifications</strong>
            <button style={linkBtn} onClick={markAllRead}>Mark all read</button>
          </div>
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            {loading && <div style={{ padding: 10, color: '#64748b' }}>Loading…</div>}
            {!loading && items.length === 0 && <div style={{ padding: 10, color: '#64748b' }}>No notifications</div>}
            {!loading && items.map(n => (
              <div 
                key={n.id} 
                onClick={() => handleNotificationClick(n)}
                style={{ 
                  padding: 10, 
                  borderBottom: '1px solid #f1f5f9', 
                  background: n.is_read ? '#fff' : '#fffbeb',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? '#fff' : '#fffbeb'}
              >
                <div style={{ fontSize: 13, color: '#111827', fontWeight: n.is_read ? 400 : 500 }}>{n.message || n.type}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: '#2563eb' }}>View →</span>
                  {!n.is_read && (
                    <button 
                      style={{ ...linkBtn, fontSize: 11 }} 
                      onClick={(e) => markRead(n.id, e)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <div style={{ padding: 8, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
              <a href="/notifications" style={{ color: '#2563eb', fontSize: 12, textDecoration: 'none' }}>
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const bellBtnStyle = {
  position: 'relative',
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.7)',
  background: 'transparent',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14
}
const badgeStyle = {
  position: 'absolute',
  top: -6,
  right: -6,
  background: '#dc2626',
  color: '#fff',
  borderRadius: 999,
  padding: '0 6px',
  fontSize: 10,
  lineHeight: '16px',
  height: 16,
  minWidth: 16,
  textAlign: 'center'
}
const panelStyle = {
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 6px)',
  width: 320,
  background: '#fff',
  color: '#111827',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
  zIndex: 1001
}
const linkBtn = {
  background: 'transparent',
  border: 'none',
  color: '#2563eb',
  cursor: 'pointer',
  fontSize: 12
}