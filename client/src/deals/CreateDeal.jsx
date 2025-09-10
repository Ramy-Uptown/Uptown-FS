import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import CalculatorApp from '../App.jsx'

export default function CreateDeal() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function saveAsDraft() {
    try {
      setError('')
      setLoading(true)
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

      // Persist entire snapshot into details
      const details = {
        calculator: {
          ...snap
        }
      }

      const resp = await fetchWithAuth(`${API_URL}/api/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, amount, unitType, details })
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h2 style={{ marginTop: 0 }}>Create Deal</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={saveAsDraft} disabled={loading} style={btnPrimary}>{loading ? 'Saving…' : 'Save as Draft'}</button>
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