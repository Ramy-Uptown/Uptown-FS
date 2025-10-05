import React from 'react'

/**
 * LoadingButton
 * - Shows a subtle loading state and disables while loading.
 * - Variants: 'default' and 'primary' to match existing style tokens.
 */
export default function LoadingButton({
  loading = false,
  disabled = false,
  children,
  onClick,
  variant = 'default',
  style,
  ...rest
}) {
  const base = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #d1d9e6',
    background: '#fff',
    color: '#111827',
    cursor: 'pointer',
    opacity: loading ? 0.8 : 1
  }
  const primary = {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #1f6feb',
    background: '#1f6feb',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    opacity: loading ? 0.85 : 1
  }
  const combined = {
    ...(variant === 'primary' ? primary : base),
    ...(style || {})
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={combined}
      {...rest}
    >
      {loading ? (typeof children === 'string' ? children.replace(/\\.\\.\\.$/, '') + '…' : children) : children}
    </button>
  )
}