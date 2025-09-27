import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'

export default function PaymentThresholds() {
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const role = user?.role

  const [thresholds, setThresholds] = useState({
    firstYearPercentMin: '',
    firstYearPercentMax: '',
    secondYearPercentMin: '',
    secondYearPercentMax: '',
    handoverPercentMin: '',
    handoverPercentMax: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [proposals, setProposals] = useState([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalMsg, setProposalMsg] = useState('')

  async function loadActive() {
    const resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds`)
    const data = await resp.json()
    if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load thresholds')
    setThresholds({
      firstYearPercentMin: data.thresholds.firstYearPercentMin ?? '',
      firstYearPercentMax: data.thresholds.firstYearPercentMax ?? '',
      secondYearPercentMin: data.thresholds.secondYearPercentMin ?? '',
      secondYearPercentMax: data.thresholds.secondYearPercentMax ?? '',
      handoverPercentMin: data.thresholds.handoverPercentMin ?? '',
      handoverPercentMax: data.thresholds.handoverPercentMax ?? ''
    })
  }

  async function loadProposals() {
    setProposalsLoading(true)
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds/proposals`)
      const data = await resp.json()
      if (resp.ok) {
        setProposals(data.proposals || [])
      } else {
        setProposalMsg(data?.error?.message || 'Could not load proposals')
      }
    } catch (e) {
      setProposalMsg(e.message || String(e))
    } finally {
      setProposalsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        await loadActive()
      } catch (e) {
        setError(e.message || String(e))
      } finally {
        setLoading(false)
      }
      // Load proposals for FM and top management roles
      if (['financial_manager', 'ceo', 'chairman', 'vice_chairman', 'top_management'].includes(role)) {
        loadProposals().catch(() => {})
      }
    })()
    return () => { mounted = false }
  }, [])

  const onChange = (key) => (e) => {
    const val = e.target.value
    setThresholds(s => ({ ...s, [key]: val }))
  }

  // Financial Manager: submit proposal
  async function submitProposal() {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      setProposalMsg('')
      const body = Object.fromEntries(Object.entries(thresholds).map(([k, v]) => [k, v === '' ? null : Number(v)]))
      const resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to submit proposal')
      setSuccess('Proposal submitted for approval')
      await loadProposals()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  // Top Management: approve/reject
  async function actOnProposal(id, action) {
    try {
      setProposalMsg('')
      const resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds/proposals/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' })
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error?.message || `Failed to ${action} proposal`)
      if (action === 'approve') {
        setSuccess('Proposal approved and thresholds updated')
        await loadActive()
      } else {
        setSuccess('Proposal rejected')
      }
      await loadProposals()
    } catch (e) {
      setProposalMsg(e.message || String(e))
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Payment Thresholds</h2>
      <p style={{ color: '#64748b' }}>
        Financial Manager proposes thresholds. Top Management approves or rejects. Active thresholds are shown and used by the calculator.
      </p>

      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
      {success ? <p style={{ color: '#10b981' }}>{success}</p> : null}

      <h3 style={{ marginTop: 16 }}>Active Thresholds</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 640 }}>
        <div>
          <label>First Year Min (%)</label>
          <input type="number" step="0.01" value={thresholds.firstYearPercentMin} onChange={onChange('firstYearPercentMin')} style={inputStyle} disabled={role !== 'financial_manager'} />
        </div>
        <div>
          <label>First Year Max (%)</label>
          <input type="number" step="0.01" value={thresholds.firstYearPercentMax} onChange={onChange('firstYearPercentMax')} style={inputStyle} disabled={role !== 'financial_manager'} />
        </div>
        <div>
          <label>Second Year Min (%)</label>
          <input type="number" step="0.01" value={thresholds.secondYearPercentMin} onChange={onChange('secondYearPercentMin')} style={inputStyle} disabled={role !== 'financial_manager'} />
        </div>
        <div>
          <label>Second Year Max (%)</label>
          <input type="number" step="0.01" value={thresholds.secondYearPercentMax} onChange={onChange('secondYearPercentMax')} style={inputStyle} disabled={role !== 'financial_manager'} />
        </div>
        <div>
          <label>Handover Min (%)</label>
          <input type="number" step="0.01" value={thresholds.handoverPercentMin} onChange={onChange('handoverPercentMin')} style={inputStyle} disabled={role !== 'financial_manager'} />
        </div>
        <div>
          <label>Handover Max (%)</label>
          <input type="number" step="0.01" value={thresholds.handoverPercentMax} onChange={onChange('handoverPercentMax')} style={inputStyle} disabled={role !== 'financial_manager'} />
        </div>
      </div>

      {role === 'financial_manager' && (
        <div style={{ marginTop: 16 }}>
          <button onClick={submitProposal} disabled={saving} style={btnPrimaryStyle}>
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      )}

      {['financial_manager', 'ceo', 'chairman', 'vice_chairman', 'top_management'].includes(role) && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginTop: 0 }}>Pending Proposals</h3>
          {proposalsLoading ? <p>Loading proposals...</p> : null}
          {proposalMsg ? <p style={{ color: '#e11d48' }}>{proposalMsg}</p> : null}
          {proposals.length === 0 ? (
            <p style={{ color: '#64748b' }}>No pending proposals.</p>
          ) : (
            <div style={{ border: '1px solid #e6eaf0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>ID</th>
                    <th style={th}>Proposed By</th>
                    <th style={th}>Date</th>
                    <th style={th}>Summary</th>
                    {['ceo', 'chairman', 'vice_chairman', 'top_management'].includes(role) && <th style={th}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {proposals.map(p => (
                    <tr key={p.id}>
                      <td style={td}>{p.id}</td>
                      <td style={td}>{p.proposed_by}</td>
                      <td style={td}>{p.proposed_at ? new Date(p.proposed_at).toLocaleString() : ''}</td>
                      <td style={td}>
                        FY: {p.thresholds.firstYearPercentMin ?? '-'}–{p.thresholds.firstYearPercentMax ?? '-'}%,
                        SY: {p.thresholds.secondYearPercentMin ?? '-'}–{p.thresholds.secondYearPercentMax ?? '-'}%,
                        HO: {p.thresholds.handoverPercentMin ?? '-'}–{p.thresholds.handoverPercentMax ?? '-'}%
                      </td>
                      {['ceo', 'chairman', 'vice_chairman', 'top_management'].includes(role) && (
                        <td style={td}>
                          <button onClick={() => actOnProposal(p.id, 'approve')} style={btnGreen}>Approve</button>
                          <button onClick={() => actOnProposal(p.id, 'reject')} style={btnRed}>Reject</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d1d9e6',
  outline: 'none',
  width: '100%',
  fontSize: 14,
  background: '#fff'
}

const btnPrimaryStyle = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #1f6feb',
  background: '#1f6feb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600
}

const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eef2f7', fontSize: 13, color: '#475569', background: '#f9fbfd' }
const td = { padding: 10, borderBottom: '1px solid #f2f5fa', fontSize: 14 }

const btnGreen = {
  marginRight: 8,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #10b981',
  background: '#ecfdf5',
  color: '#065f46',
  cursor: 'pointer'
}
const btnRed = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #ef4444',
  background: '#fef2f2',
  color: '#7f1d1d',
  cursor: 'pointer'
}