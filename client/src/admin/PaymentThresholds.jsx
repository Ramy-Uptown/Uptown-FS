import React, { useEffect, useState, useMemo } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import { notifyError, notifySuccess } from '../lib/notifications.js'

export default function PaymentThresholds() {
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
  const role = user?.role
  const isTopMgmt = ['ceo', 'chairman', 'vice_chairman', 'top_management'].includes(role)
  const headerTitle = isTopMgmt ? 'Payment Threshold Approvals' : 'Payment Thresholds'
  const [selectedTab, setSelectedTab] = useState(isTopMgmt ? 'proposals' : 'active')
  const tabs = useMemo(() => ([
    { key: 'active', label: 'Active', disabled: false },
    { key: 'proposals', label: 'Proposals', disabled: false },
    { key: 'history', label: 'History', disabled: false }
  ]), [isTopMgmt])

  const [thresholds, setThresholds] = useState({
    firstYearPercentMin: '',
    firstYearPercentMax: '',
    secondYearPercentMin: '',
    secondYearPercentMax: '',
    thirdYearPercentMin: '',
    thirdYearPercentMax: '',
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

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyMsg, setHistoryMsg] = useState('')

  const [rowLoading, setRowLoading] = useState({})

  async function loadActive() {
    const resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds`)
    const data = await resp.json()
    if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load thresholds')
    setThresholds({
      firstYearPercentMin: data.thresholds.firstYearPercentMin ?? '',
      firstYearPercentMax: data.thresholds.firstYearPercentMax ?? '',
      secondYearPercentMin: data.thresholds.secondYearPercentMin ?? '',
      secondYearPercentMax: data.thresholds.secondYearPercentMax ?? '',
      thirdYearPercentMin: data.thresholds.thirdYearPercentMin ?? '',
      thirdYearPercentMax: data.thresholds.thirdYearPercentMax ?? '',
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
        const msg = data?.error?.message || 'Could not load proposals'
        setProposalMsg(msg)
        notifyError(msg)
      }
    } catch (e) {
      const msg = e.message || String(e)
      setProposalMsg(msg)
      notifyError(e, 'Could not load proposals')
    } finally {
      setProposalsLoading(false)
    }
  }

  async function loadHistory() {
    setHistoryLoading(true)
    setHistoryMsg('')
    try {
      let resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds/history`)
      let data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds/proposals?status=approved`)
        data = await resp.json().catch(() => ({}))
      }
      if (resp.ok) {
        const items = data.history || data.items || data.proposals || []
        setHistory(items)
      } else {
        const msg = data?.error?.message || 'Could not load approvals history'
        setHistory([])
        setHistoryMsg(msg)
        notifyError(msg)
      }
    } catch (e) {
      const msg = e.message || String(e)
      setHistoryMsg(msg)
      notifyError(e, 'Could not load approvals history')
    } finally {
      setHistoryLoading(false)
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
      if (['financial_manager', 'ceo', 'chairman', 'vice_chairman', 'top_management'].includes(role)) {
        loadProposals().catch(() => {})
        loadHistory().catch(() => {})
      }
    })()
    return () => { mounted = false }
  }, [role])

  const onChange = (key) => (e) => {
    const val = e.target.value
    setThresholds(s => ({ ...s, [key]: val }))
  }

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
      notifySuccess('Proposal submitted for approval')
      await loadProposals()
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(e, 'Failed to submit proposal')
    } finally {
      setSaving(false)
    }
  }

  async function actOnProposal(id, action) {
    try {
      setProposalMsg('')
      setRowLoading(s => ({ ...s, [id]: true }))
      const resp = await fetchWithAuth(`${API_URL}/api/config/payment-thresholds/proposals/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' })
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error?.message || `Failed to ${action} proposal`)
      if (action === 'approve') {
        setSuccess('Proposal approved and thresholds updated')
        notifySuccess('Proposal approved')
        await loadActive()
      } else {
        setSuccess('Proposal rejected')
        notifySuccess('Proposal rejected')
      }
      await loadProposals()
    } catch (e) {
      const msg = e.message || String(e)
      setProposalMsg(msg)
      notifyError(e, `Failed to ${action} proposal`)
    } finally {
      setRowLoading(s => ({ ...s, [id]: false }))
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
        <AdminSidebar role={user?.role} />
        
        <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
            <div className="w-full mx-auto space-y-6">

                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-display font-bold text-primary tracking-wide">{headerTitle}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {role === 'financial_manager'
                                ? 'Set collection thresholds for the payment calculator.'
                                : 'Review and approve global payment collection thresholds.'}
                        </p>
                    </div>
                </div>

                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {tabs.map(t => {
                             const active = selectedTab === t.key
                             const muted = isTopMgmt && t.key === 'active'
                             return (
                                <button
                                    key={t.key}
                                    onClick={() => !t.disabled && setSelectedTab(t.key)}
                                    disabled={t.disabled}
                                    className={`
                                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                        ${active ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                                        ${muted ? 'opacity-60' : 'opacity-100'}
                                        ${t.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                    `}
                                >
                                    {t.label}
                                </button>
                             )
                        })}
                    </nav>
                </div>

                {loading && <div className="text-center py-4 bg-white rounded-lg shadow-sm border border-gray-100"><span className="text-gray-500 text-sm">Loading configuration...</span></div>}
                
                {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100 text-sm">{error}</div>}
                {success && <div className="p-4 bg-green-50 text-green-700 rounded-md border border-green-100 text-sm">{success}</div>}

                {/* Active Tab */}
                {selectedTab === 'active' && (
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900">Current Thresholds</h3>
                            {role === 'financial_manager' && <span className="text-xs text-gray-500">Edit values and submit for approval.</span>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                                { key: 'firstYear', label: 'First Year (%)' },
                                { key: 'secondYear', label: 'Second Year (%)' },
                                { key: 'thirdYear', label: 'Third Year (%)' },
                                { key: 'handover', label: 'Handover (%)' }
                            ].map(group => (
                                <React.Fragment key={group.key}>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{group.label} Min</label>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            value={thresholds[`${group.key}PercentMin`]} 
                                            onChange={onChange(`${group.key}PercentMin`)}
                                            disabled={role !== 'financial_manager'}
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{group.label} Max</label>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            value={thresholds[`${group.key}PercentMax`]} 
                                            onChange={onChange(`${group.key}PercentMax`)}
                                            disabled={role !== 'financial_manager'}
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                        />
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>

                        {role === 'financial_manager' && (
                            <div className="pt-4 border-t border-gray-100 flex justify-end">
                                <LoadingButton 
                                    onClick={submitProposal} 
                                    loading={saving}
                                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
                                >
                                    Submit for Approval
                                </LoadingButton>
                            </div>
                        )}
                    </div>
                )}

                {/* Proposals Tab */}
                {selectedTab === 'proposals' && (
                     <div className="space-y-6">
                        {role === 'financial_manager' && (
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 flex justify-between items-center text-sm text-yellow-800">
                                <span>Modify values in the <strong>Active</strong> tab, then check back here.</span>
                            </div>
                        )}

                        {proposalsLoading && <div className="text-center py-8 text-gray-500">Loading proposals...</div>}
                        {proposalMsg && <div className="text-red-600 text-sm">{proposalMsg}</div>}

                        {!proposalsLoading && proposals.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                                <p className="text-gray-500 text-sm">No pending proposals found.</p>
                            </div>
                        )}

                        {proposals.length > 0 && (
                            <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-300">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Proposed By</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Proposed Thresholds (Min-Max%)</th>
                                                {isTopMgmt && <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {proposals.map(p => (
                                                <tr key={p.id}>
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{p.id}</td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{p.proposed_by}</td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{p.proposed_at ? new Date(p.proposed_at).toLocaleString() : ''}</td>
                                                    <td className="px-3 py-4 text-sm text-gray-500 text-xs">
                                                        <div className="space-y-1">
                                                            <div><span className="font-semibold">FY:</span> {p.thresholds.firstYearPercentMin ?? '-'}–{p.thresholds.firstYearPercentMax ?? '-'}%</div>
                                                            <div><span className="font-semibold">SY:</span> {p.thresholds.secondYearPercentMin ?? '-'}–{p.thresholds.secondYearPercentMax ?? '-'}%</div>
                                                            <div><span className="font-semibold">TY:</span> {p.thresholds.thirdYearPercentMin ?? '-'}–{p.thresholds.thirdYearPercentMax ?? '-'}%</div>
                                                            <div><span className="font-semibold">HO:</span> {p.thresholds.handoverPercentMin ?? '-'}–{p.thresholds.handoverPercentMax ?? '-'}%</div>
                                                        </div>
                                                    </td>
                                                    {isTopMgmt && (
                                                        <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                            <div className="flex gap-2 justify-end">
                                                                <LoadingButton 
                                                                    onClick={() => actOnProposal(p.id, 'approve')} 
                                                                    loading={rowLoading[p.id]}
                                                                    className="inline-flex justify-center items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
                                                                >
                                                                    Approve
                                                                </LoadingButton>
                                                                <LoadingButton 
                                                                    onClick={() => actOnProposal(p.id, 'reject')} 
                                                                    loading={rowLoading[p.id]}
                                                                    className="inline-flex justify-center items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
                                                                >
                                                                    Reject
                                                                </LoadingButton>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                     </div>
                )}

                {/* History Tab */}
                {selectedTab === 'history' && (
                    <div className="space-y-6">
                         {historyLoading && <div className="text-center py-8 text-gray-500">Loading history...</div>}
                         {historyMsg && <div className="text-red-600 text-sm">{historyMsg}</div>}

                         {!historyLoading && history.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                                <p className="text-gray-500 text-sm">No history records found.</p>
                            </div>
                        )}

                        {history.length > 0 && (
                             <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-300">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Approved By</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Approved At</th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Approved Thresholds</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {history.map(h => (
                                                <tr key={h.id || `${h.approved_at}-${h.approved_by || ''}`} className="hover:bg-gray-50 transition-colors">
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{h.id ?? '-'}</td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{h.approved_by || h.actor || '-'}</td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{h.approved_at ? new Date(h.approved_at).toLocaleString() : (h.date ? new Date(h.date).toLocaleString() : '')}</td>
                                                    <td className="px-3 py-4 text-sm text-gray-500 text-xs">
                                                        <div className="space-y-1">
                                                            <div><span className="font-semibold">FY:</span> {(h.thresholds?.firstYearPercentMin ?? h.firstYearPercentMin) ?? '-'}–{(h.thresholds?.firstYearPercentMax ?? h.firstYearPercentMax) ?? '-'}%</div>
                                                            <div><span className="font-semibold">SY:</span> {(h.thresholds?.secondYearPercentMin ?? h.secondYearPercentMin) ?? '-'}–{(h.thresholds?.secondYearPercentMax ?? h.secondYearPercentMax) ?? '-'}%</div>
                                                            <div><span className="font-semibold">TY:</span> {(h.thresholds?.thirdYearPercentMin ?? h.thirdYearPercentMin) ?? '-'}–{(h.thresholds?.thirdYearPercentMax ?? h.thirdYearPercentMax) ?? '-'}%</div>
                                                            <div><span className="font-semibold">HO:</span> {(h.thresholds?.handoverPercentMin ?? h.handoverPercentMin) ?? '-'}–{(h.thresholds?.handoverPercentMax ?? h.handoverPercentMax) ?? '-'}%</div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </main>
    </div>
  )
}