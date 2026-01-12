import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'

export default function SettingsUnlockRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('pending')
  const [role, setRole] = useState('')

  useEffect(() => {
    try {
        const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
        setRole(u?.role || 'user')
    } catch {}
  }, [])

  async function loadRequests() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/deals/settings-unlock-requests?status=${filter}`)
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Failed to load requests')
      }
      setRequests(data.requests || [])
    } catch (e) {
      setError(e.message || String(e))
      notifyError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [filter])

  async function handleApprove(requestId) {
    if (!confirm('Approve this request? The contract settings will be unlocked for editing.')) return
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/deals/settings-unlock-requests/${requestId}/approve`, {
        method: 'POST'
      })
      const data = await resp.json()
      if (resp.ok) {
        notifySuccess('Request approved, settings unlocked')
        loadRequests()
      } else {
        notifyError(data?.error?.message || 'Failed to approve')
      }
    } catch (e) {
      notifyError(e.message)
    }
  }

  async function handleReject(requestId) {
    if (!confirm('Reject this request?')) return
    try {
      const resp = await fetchWithAuth(`${API_URL}/api/deals/settings-unlock-requests/${requestId}/reject`, {
        method: 'POST'
      })
      const data = await resp.json()
      if (resp.ok) {
        notifySuccess('Request rejected')
        loadRequests()
      } else {
        notifyError(data?.error?.message || 'Failed to reject')
      }
    } catch (e) {
      notifyError(e.message)
    }
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="w-full mx-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <div>
               <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Contract Unlock Requests</h2>
               <p className="text-sm text-gray-500 mt-1">Manage requests to unlock confidential contract settings.</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
               {['pending', 'approved', 'rejected'].map(s => (
                  <button
                     key={s}
                     onClick={() => setFilter(s)}
                     className={`
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize
                        ${filter === s
                           ? 'border-primary text-primary'
                           : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                     `}
                  >
                     {s} Requests
                  </button>
               ))}
            </nav>
          </div>

          {loading && <SkeletonRow widths={['w-full', 'w-full', 'w-3/4']} />}
          {error && <p className="text-red-600 bg-red-50 p-4 rounded-md border border-red-200">{error}</p>}

          {!loading && requests.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500">No {filter} requests found.</p>
            </div>
          )}

          {!loading && requests.length > 0 && (
            <div className="space-y-4">
               {requests.map(req => (
                  <div 
                     key={req.id} 
                     className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-start gap-4 transition-shadow hover:shadow-md"
                  >
                     <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 uppercase tracking-wide">
                              Deal #{req.deal_id}
                           </span>
                           <h3 className="text-lg font-medium text-gray-900">
                              <Link to={`/contracts/${req.deal_id}`} className="hover:text-primary transition-colors">
                                 {req.deal_title || 'Untitled Deal'}
                              </Link>
                           </h3>
                        </div>
                        
                        <div className="text-sm text-gray-500 mb-2">
                           Requested by <span className="font-medium text-gray-900">{req.requested_by_name || req.requested_by_email}</span> on {formatDate(req.created_at)}
                        </div>
                        
                        {req.reason && (
                           <div className="bg-gray-50 p-3 rounded-md border border-gray-100 text-sm text-gray-700 mt-2">
                              <span className="font-medium text-gray-900">Reason:</span> {req.reason}
                           </div>
                        )}
                     </div>

                     <div className="flex-shrink-0 flex gap-2">
                        {filter === 'pending' && (
                           <>
                              <button
                                 onClick={() => handleApprove(req.id)}
                                 className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                 Approve
                              </button>
                              <button
                                 onClick={() => handleReject(req.id)}
                                 className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                 Reject
                              </button>
                           </>
                        )}
                        {filter !== 'pending' && (
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                              ${filter === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {filter}
                           </span>
                        )}
                     </div>
                  </div>
               ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
