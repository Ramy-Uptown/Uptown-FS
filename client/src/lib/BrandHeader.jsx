import React, { useEffect, useState } from 'react'

const BRAND = {
  primary: '#A97E34', // corporate color
  primaryDark: '#8B672C'
}

/**
 * BrandHeader will auto-detect a logo dropped into:
 *  - /logo/logo.svg (preferred)
 *  - /logo/logo.png
 *  - /logo/logo.jpg
 * (served by Vite from client/public/logo/*)
 *
 * Backwards/alternate support:
 *  - /branding/logo.(svg|png|jpg)
 *
 * Order of precedence:
 *  1) File present in /logo (svg -> png -> jpg)
 *  2) File present in /branding (svg -> png -> jpg)
 *  3) VITE_COMPANY_LOGO_URL (if provided)
 *  4) Default /logo.svg committed in the repo
 */
export default function BrandHeader({ title, onLogout }) {
  const appTitle = title || (import.meta.env.VITE_APP_TITLE || 'Uptown Financial System')
  const envLogo = import.meta.env.VITE_COMPANY_LOGO_URL || ''
  const [logoUrl, setLogoUrl] = useState('/logo.svg')
  const [user, setUser] = useState(null)

  useEffect(() => {
    let mounted = true
    const candidates = [
      '/logo/logo.svg',
      '/logo/logo.png',
      '/logo/logo.jpg',
      '/branding/logo.svg',
      '/branding/logo.png',
      '/branding/logo.jpg',
      envLogo || '',
      '/logo.svg'
    ].filter(Boolean)

    // Attempt to load candidates in order and pick the first that succeeds
    const tryNext = (idx) => {
      if (!mounted || idx >= candidates.length) return
      const url = candidates[idx]
      const img = new Image()
      img.onload = () => {
        if (mounted) setLogoUrl(url)
      }
      img.onerror = () => tryNext(idx + 1)
      img.src = url
    }
    tryNext(0)
    try {
      const raw = localStorage.getItem('auth_user')
      if (raw) setUser(JSON.parse(raw))
    } catch {}
    return () => { mounted = false }
  }, [envLogo])

  const navForRole = (role) => {
    // Map role to visible shortcuts
    const base = [{ label: 'Calculator', href: '/' }]
    switch (role) {
      case 'superadmin':
        return [
          ...base,
          { label: 'Units', href: '/admin/units' },
          { label: 'Standard Pricing', href: '/admin/standard-pricing' },
          { label: 'Users', href: '/admin/users' },
          { label: 'Sales Team', href: '/admin/sales-team' },
          { label: 'Commission Policies', href: '/admin/commission-policies' },
          { label: 'Commissions Report', href: '/admin/commissions-report' }
        ]
      case 'admin':
      case 'financial_manager':
        return [
          ...base,
          { label: 'Units', href: '/admin/units' },
          { label: 'Standard Pricing', href: '/admin/standard-pricing' },
          { label: 'Users', href: '/admin/users' },
          { label: 'Commission Policies', href: '/admin/commission-policies' },
          { label: 'Team Proposals', href: '/deals/team-proposals' },
          { label: 'Sales Assignments', href: '/admin/sales-assignments' },
          { label: 'Holds', href: '/admin/holds' }
        ]
      case 'financial_admin':
        return [
          ...base,
          { label: 'Units', href: '/admin/units' },
          { label: 'Standard Pricing', href: '/admin/standard-pricing' },
          { label: 'My Proposals', href: '/deals/my-proposals' }
        ]
      case 'sales_manager':
        return [
          ...base,
          { label: 'Team Proposals', href: '/deals/team-proposals' },
          { label: 'Sales Assignments', href: '/admin/sales-assignments' }
        ]
      case 'property_consultant':
        return [
          ...base,
          { label: 'My Proposals', href: '/deals/my-proposals' }
        ]
      case 'contract_person':
      case 'contract_manager':
        return base
      case 'ceo':
      case 'chairman':
      case 'vicechairman':
        return [
          ...base,
          { label: 'Workflow Logs', href: '/admin/workflow-logs' }
        ]
      default:
        return base
    }
  }

  const shortcuts = navForRole(user?.role)

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 1000, background: BRAND.primary, color: '#fff', borderBottom: `4px solid ${BRAND.primaryDark}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Company Logo" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          ) : (
            <div style={{ height: 36, width: 36, borderRadius: 6, background: '#fff', color: BRAND.primary, display: 'grid', placeItems: 'center', fontWeight: 800 }}>U</div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{appTitle}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              Welcome {user?.email || ''} {user?.role ? `(${user.role})` : ''} • Shortcuts:
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {shortcuts.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => { window.location.href = s.href }}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.7)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 12 }}
            >
              {s.label}
            </button>
          ))}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.7)', background: 'transparent', color: '#fff', cursor: 'pointer' }}
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </div>
  )
}