import React from 'react'

export default function FullPageLoader({ show = false, message = 'Processing, please wait...' }) {
  if (!show) return null
  const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.55)', // semi-transparent dark
    zIndex: 9999,
    display: 'grid',
    placeItems: 'center'
  }
  const box = {
    background: '#111827',
    color: '#fff',
    padding: '20px 24px',
    borderRadius: 12,
    minWidth: 320,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12
  }
  const spinner = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    animation: 'spin 1s linear infinite'
  }
  const styleTag = (
    <style>
      {`@keyframes spin { to { transform: rotate(360deg); } }`}
    </style>
  )
  return (
    <div style={overlay} aria-live="polite" aria-busy="true">
      {styleTag}
      <div style={box}>
        <div style={spinner} role="progressbar" aria-label="Loading" />
        <div style={{ fontSize: 14, textAlign: 'center' }}>{message}</div>
      </div>
    </div>
  )
}