import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'

export default function ContractsList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [candidatesError, setCandidatesError] = useState('')
  const [role, setRole] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth_user')
      if (raw) {
        const u = JSON.parse(raw)
        setRole(u?.role || '')
      }
    } catch {}
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/contracts`)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Failed to load contracts')
      }
      const list = Array.isArray(data.contracts) ? data.contracts : []
      setRows(list)
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(msg, 'Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function loadCandidates() {
    try {
      setCandidatesLoading(true)
      setCandidatesError('')
      const resp = await fetchWithAuth(`${API_URL}/api/contracts/candidates`)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Failed to load reservation forms')
      }
      const list = Array.isArray(data.reservation_forms) ? data.reservation_forms : []
      setCandidates(list)
    } catch (e) {
      const msg = e.message || String(e)
      setCandidatesError(msg)
      notifyError(msg, 'Failed to load reservation forms')
      setCandidates([])
    } finally {
      setCandidatesLoading(false)
    }
  }

  function formatStatus(status) {
    if (!status) return '-'
    const s = String(status).toLowerCase()
    if (s === 'pending_cm') return 'Pending CM'
    if (s === 'pending_tm') return 'Pending TM'
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Contracts Queue</h2>
              <p className="text-sm text-gray-500 mt-1">Manage unit contracts, reviews, and sign-offs.</p>
            </div>
            <div className="flex gap-3">
              <LoadingButton 
                onClick={load} 
                loading={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Refresh
              </LoadingButton>
              <button
                onClick={async () => {
                  const nextSelecting = !selecting
                  setSelecting(nextSelecting)
                  if (nextSelecting && candidates.length === 0) {
                    await loadCandidates()
                  }
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                {selecting ? 'Hide Candidates' : 'New Contract'}
              </button>
            </div>
          </div>

          {error && <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-100">{error}</div>}

          {/* Candidates Panel */}
          {selecting && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 overflow-hidden mb-6 filter drop-shadow animate-fade-in-down">
              <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Approved Reservation Forms (Ready for Contract)</h3>
              
              {candidatesError && <p className="text-sm text-red-600 mb-2">{candidatesError}</p>}
              {candidatesLoading && <SkeletonRow widths={['w-full', 'w-full']} />}
              
              {!candidatesLoading && !candidatesError && candidates.length === 0 && (
                <p className="text-sm text-gray-500 italic py-2">No approved reservation forms found without contracts.</p>
              )}

              {!candidatesLoading && candidates.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RF #</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buyer</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="relative px-6 py-3"><span className="sr-only">Create</span></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {candidates.map(rf => (
                        <tr key={rf.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{rf.id}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{rf.deal_id || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 font-medium">{rf.unit_code}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{rf.buyer_name}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{rf.reservation_date ? new Date(rf.reservation_date).toLocaleDateString() : '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                            <LoadingButton
                              onClick={async () => {
                                try {
                                  setCreating(true)
                                  const resp = await fetchWithAuth(`${API_URL}/api/contracts`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ reservation_form_id: rf.id })
                                  })
                                  const data = await resp.json().catch(() => ({}))
                                  if (!resp.ok) throw new Error(data?.error?.message || 'Failed to create contract')
                                  const created = data.contract
                                  if (created && created.id) {
                                    navigate(`/contracts/${created.id}`)
                                  } else {
                                    await load()
                                  }
                                } catch (e) {
                                  notifyError(e, 'Failed to create contract')
                                } finally {
                                  setCreating(false)
                                }
                              }}
                              disabled={creating}
                              className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded-md border border-green-200 text-xs"
                            >
                              {creating ? 'Creating...' : 'Create Contract'}
                            </LoadingButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Contracts Table */}
          <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Deal #</th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit Code</th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Buyer</th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading && (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={7} className="px-3 py-4"><SkeletonRow widths={['sm', 'sm', 'md', 'lg', 'sm', 'md', 'xs']} /></td></tr>
                    ))
                  )}
                  {!loading && rows.map(c => {
                    const status = formatStatus(c.status)
                    const unitCode = c.unit_code || c.unit?.unit_code || '-'
                    const buyerName = c.buyer_name || c.buyer || c.client_name || '-'
                    const createdAt = c.created_at ? new Date(c.created_at).toLocaleString() : '-'
                    
                    // Status Badge Logic
                    let badgeClass = 'bg-gray-100 text-gray-800'
                    if (status === 'Approved' || status === 'Executed') badgeClass = 'bg-green-100 text-green-800'
                    else if (status.includes('Pending')) badgeClass = 'bg-blue-100 text-blue-800'
                    else if (status === 'Rejected') badgeClass = 'bg-red-100 text-red-800'

                    return (
                      <tr 
                        key={c.id} 
                        onClick={() => navigate(`/contracts/${c.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">#{c.id}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{c.deal_id || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">{unitCode}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{buyerName}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${badgeClass}`}>
                            {status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{createdAt}</td>
                        <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <span className="text-primary hover:text-primary-hover">View<span className="sr-only">, {c.id}</span></span>
                        </td>
                      </tr>
                    )
                  })}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">No contracts found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}