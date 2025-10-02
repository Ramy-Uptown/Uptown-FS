import React, { useEffect, useRef, useState } from 'react'
import LoadingButton from './LoadingButton.jsx'

/**
 * Accessible prompt modal.
 * Props:
 * - open: boolean
 * - title?: string
 * - message?: string
 * - placeholder?: string
 * - defaultValue?: string
 * - confirmText?: string
 * - cancelText?: string
 * - onSubmit: (value: string) => void
 * - onCancel: () => void
 */
export default function PromptModal({
  open,
  title = 'Enter value',
  message = '',
  placeholder = '',
  defaultValue = '',
  confirmText = 'Submit',
  cancelText = 'Cancel',
  onSubmit,
  onCancel,
}) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue ?? '')
      setTimeout(() => {
        try { inputRef.current && inputRef.current.focus() } catch {}
      }, 0)
    }
  }, [open, defaultValue])

  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="prompt-modal-title" style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h3 id="prompt-modal-title" style={{ margin: 0 }}>{title}</h3>
        </div>
        <div style={bodyStyle}>
          {message ? <p style={{ marginTop: 0 }}>{message}</p> : null}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            style={inputStyle}
          />
        </div>
        <div style={footerStyle}>
          <LoadingButton onClick={() => onSubmit(value)} variant="primary">{confirmText}</LoadingButton>
          <LoadingButton onClick={onCancel}>{cancelText}</LoadingButton>
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

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d9e6'
}