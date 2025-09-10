import React, { useEffect, useState } from 'react'

const BRAND = {
  primary: '#A97E34', // corporate color
  primaryDark: '#8B672C'
}

/**
 * BrandHeader will auto-detect a logo dropped into:
 *  - /branding/logo.svg
 *  - /branding/logo.png
 *  - /branding/logo.jpg
 * (served by Vite from client/public/branding/*)
 *
 * Order of precedence:
 *  1) File present in /branding (svg -> png -> jpg)
 *  2) VITE_COMPANY_LOGO_URL (if provided)
 *  3) Default /logo.svg committed in the repo
 */
export default function BrandHeader({ title, onLogout }) {
  const appTitle = title || (import.meta.env.VITE_APP_TITLE || 'Uptown Financial System')
  const envLogo = import.meta.env.VITE_COMPANY_LOGO_URL || ''
  const [logoUrl, setLogoUrl] = useState('/logo.svg')

  useEffect(() => {
    let mounted = true
    const candidates = [
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
    return () => { mounted = false }
  }, [envLogo])

  return (
    <div style={{ background: BRAND.primary, color: '#fff', borderBottom: `4px solid ${BRAND.primaryDark}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Company Logo" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          ) : (
            <div style={{ height: 36, width: 36, borderRadius: 6, background: '#fff', color: BRAND.primary, display: 'grid', placeItems: 'center', fontWeight: 800 }}>U</div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{appTitle}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Deal Management & Payment Plans</div>
          </div>
        </div>
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
  )
}