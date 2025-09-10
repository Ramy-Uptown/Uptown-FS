import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import CalculatorApp from '../App.jsx'

export default function CreateDeal() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function buildPayloadFromSnapshot() {
    const snapFn = window.__uptown_calc_getSnapshot
    if (typeof snapFn !== 'function') {
      throw new Error('Calculator not ready yet. Please try again in a moment.')
    }
    const snap = snapFn()
    // Build title, amount, unit type from snapshot
    const titleParts = []
    if (snap?.clientInfo?.buyer_name) titleParts.push(snap.clientInfo.buyer_name)
    if (snap?.unitInfo?.unit_code || snap?.unitInfo?.unit_number) {
      titleParts.push(snap.unitInfo.unit_code || snap.unitInfo.unit_number)
    }
    const title = titleParts.join(' - ') || 'New Deal'
    const amount = Number(snap?.generatedPlan?.totals?.totalNominal ?? snap?.stdPlan?.totalPrice ?? 0)
    const unitType = snap?.unitInfo?.unit_type || null
    const details = { calculator: { ...snap } }
    return { title, amount, unitType, details }
  }

  async function saveAsDraft() {
    try {
      setError('')
      setLoading(true)
      const payload = await buildPayloadFromSnapshot()
      const resp = await fetchWithAuth(`${API_URL}/api/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to create deal')
      navigate(`/deals/${data.deal.id}`)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function saveAndSubmit() {
    try {
      setError('')
      setSubmitting(true)
      const payload = await buildPayloadFromSnapshot()
      // Validation: ensure generated plan exists
      const plan = payload.details?.calculator?.generatedPlan
      if (!plan || !Array.isArray(plan.schedule) || plan.schedule.length === 0) {
        throw new Error('Please generate a payment plan before submitting.')
      }
      const resp = await fetchWithAuth(`${API_URL}/api/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to create deal')
      // Submit
      const submitResp = await fetchWithAuth(`${API_URL}/api/deals/${data.deal.id}/submit`, { method: 'POST' })
      const submitData = await submitResp.json()
      if (!submitResp.ok) throw new Error(submitData?.error?.message || 'Failed to submit deal')
      navigate(`/deals/${data.deal.id}`)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h2 style={{ marginTop: 0 }}>Create Deal</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={saveAsDraft} disabled={loading || submitting} style={btnPrimary}>{loading ? 'Saving…' : 'Save as Draft'}</button>
          <button onClick={saveAndSubmit} disabled={loading || submitting} style={btnPrimaryAlt}>{submitting ? 'Submitting…' : 'Save and Submit'}</button>
        </div>
      </div>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      <div style={{ border: '1px solid #e6eaf0', borderRadius: 12, overflow: 'hidden' }}>
        <CalculatorApp embedded />
      </div>
    </div>
  )
}

const btnPrimary = { padding: '10px 14px', borderRadius: 10, border: '1px solid #1f6feb', background: '#1f6feb', color: '#fff', fontWeight: 600 }
const btnPrimaryAlt = { padding: '10px 14px', borderRadius: 10, border: '1px solid #0d9488', background: '#0d9488', color: '#fff', fontWeight: 600 }