import React from 'react'

/**
 * Reusable status chip for payment plan workflow statuses.
 * Colors/labels centralized for consistency.
 */
export default function StatusChip({ status }) {
  const map = {
    pending_sm: { color: '#9a3412', bg: '#fff7ed', label: 'Waiting for Sales Manager' }, // orange
    pending_fm: { color: '#1e3a8a', bg: '#eff6ff', label: 'With Finance' }, // blue
    pending_tm: { color: '#991b1b', bg: '#fef2f2', label: 'Executive Approval' }, // red
    approved:   { color: '#166534', bg: '#ecfdf5', label: 'Approved' }, // green
    rejected:   { color: '#991b1b', bg: '#fef2f2', label: 'Rejected' } // red
  }
  const s = map[status] || { color: '#334155', bg: '#f1f5f9', label: status }
  return (
    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  )
}