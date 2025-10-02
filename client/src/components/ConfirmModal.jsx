import React, { useEffect, useRef } from 'react'
import LoadingButton from './LoadingButton.jsx'

/**
 * Accessible confirm modal.
 * Props:
 * - open: boolean
 * - title?: string
 * - message: string | ReactNode
 * - confirmText?: string
 * - cancelText?: string
 * - onConfirm: () => void
 * - onCancel: () => void
 */
export default function ConfirmModal({
  open,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) {
  const closeRef = useRef(null)
  useEffect(() => {
    if (open) {
      // focus the close button for keyboard accessibility
      setTimeout(() => {
        try { closeRef.current && closeRef.current.focus() } catch {}
      }, 0)
    }
  }, [open])

  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h3 id="confirm-modal-title" style={{ margin: 0 }}>{title}</h3>
        </div>
        <div style={bodyStyle}>
          {typeof message === 'string' ? <p style={{ margin: 0 }}>{message}</p> : message}
        </div>
        <div style={footerStyle}>
          <LoadingButton onClick={onConfirm} variant="primary">{confirmText}</LoadingButton>
          <LoadingButton onClick={onCancel} ref={closeRef}>{cancelText}</LoadingButton>
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
}

const modalStyle = {
  background: '#fff',
  borderRadius: 10,
  width: '100%',
  maxWidth: 480,
  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  overflow: 'hidden'
}

const headerStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid #e6eaf0'
}

const bodyStyle = {
  padding: '16px'
}

const footerStyle = {
  padding: '12px 16px',
  borderTop: '1px solid #e6eaf0',
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end'
}