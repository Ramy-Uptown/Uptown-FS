import React, { useEffect, useRef } from 'react'
import { fetchWithAuth } from '../../lib/apiClient.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function LivePreview({
  styles,
  language,
  // state & setters held in parent
  setPreview,
  setPreviewError,
  // helpers from parent
  validateForm,
  buildPayload,
  // dependencies
  mode, stdPlan, inputs, firstYearPayments, subsequentYears
}) {
  const debounceTimer = useRef(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      const { valid, payload } = validateForm()
      if (!valid) {
        setPreview(null)
        setPreviewError('Fix validation errors to see preview.')
        return
      }
      try {
        setPreviewError('')
        const resp = await fetchWithAuth(`${API_URL}/api/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await resp.json()
        if (!resp.ok) {
          setPreview(null)
          setPreviewError(data?.error?.message || 'Preview error')
        } else {
          setPreview(data?.data || null)
          // surface meta warnings
          const meta = data?.meta || {}
          const warn = []
          if (meta.policyLimit != null) {
            warn.push(`Policy limit: ${meta.policyLimit}%`)
          }
          if (meta.overPolicy) {
            warn.push('Selected discount exceeds current policy limit. Workflow will route to Top-Management.')
          }
          if (meta.authorityLimit != null) {
            warn.push(`Your authority limit: ${meta.authorityLimit}%`)
          }
          if (meta.overAuthority) {
            warn.push('Selected discount exceeds your authority. It will be escalated in workflow.')
          }
          if (warn.length) {
            setPreviewError(warn.join(' '))
          } else {
            setPreviewError('')
          }
        }
      } catch (err) {
        setPreview(null)
        setPreviewError('Could not compute preview.')
      }
    }, 500)
    return () => clearTimeout(debounceTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stdPlan, inputs, firstYearPayments, subsequentYears])

  // compute summaries here based on preview? Parent can still compute; we leave display minimal here.
  return (
    <div style={{ ...styles.blockFull, border: '1px solid #eef2f7', borderRadius: 10, padding: 12 }}>
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600 }}>Live Preview (Calculation)</h3>
      {/* Parent renders messages/summaries using its computed values; keeping component focused on effect */}
      {/* If you prefer, we can pass summaries and previewError down and render them here */}
    </div>
  )
}