import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'
import { generateReservationFormPdf } from '../lib/docExports.js'

export default function ReservationFormDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [rf, setRf] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [role, setRole] = useState('')

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
      setRole(u?.role || 'user')
    } catch {}
  }, [])

  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/workflow/reservation-forms/${id}`)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data?.error?.message || 'Failed to load reservation form')
      }
      setRf(data.reservation_form || data)
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(msg, 'Failed to load reservation form')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading && !rf) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar role={role} />
        <div className="flex-1 p-6">
          <SkeletonRow />
        </div>
      </div>
    )
  }

  if (error && !rf) {
    return (
        <div className="flex h-screen bg-gray-50">
          <AdminSidebar role={role} />
          <div className="flex-1 p-6 text-red-600">
            {error}
          </div>
        </div>
      )
  }

  if (!rf) {
    return (
        <div className="flex h-screen bg-gray-50">
          <AdminSidebar role={role} />
          <div className="flex-1 p-6">
            No reservation form found.
          </div>
        </div>
      )
  }

  const status = String(rf.status || '').toUpperCase()
  const dealId = rf.deal_id || rf.details?.deal_id || null
  const unitCode = rf.unit_code || rf.details?.unit_code || '-'
  const buyerName = rf.buyer_name || rf.details?.clientInfo?.buyer_name || '-'
  const reservationDate = rf.reservation_date || rf.details?.reservation_date || null
  const prelimAmount = rf.preliminary_payment != null ? rf.preliminary_payment : rf.details?.preliminary_payment ?? null
  
  const dp = rf.details?.dp || {}
  const dpTotal = dp.total
  const dpPrelim = dp.preliminary_amount
  const dpPrelimDate = dp.preliminary_date
  const dpPaidAmount = dp.paid_amount
  const dpPaidDate = dp.paid_date
  const dpRemaining = dp.remaining

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 p-6">
        <div className="w-full mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center gap-4">
             <button
                onClick={() => navigate(-1)}
                className="bg-white border border-gray-300 rounded-full p-2 hover:bg-gray-50 text-gray-500 transition-colors"
             >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
             </button>
             <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Reservation Form #{rf.id}</h2>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                        ${status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                          status.includes('PENDING') ? 'bg-blue-100 text-blue-800' : 
                          status === 'REJECTED' || status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                        {status.replace('_', ' ')}
                    </span>
                 </div>
                 <p className="text-sm text-gray-500 mt-1">
                    {reservationDate ? `Reserved on ${new Date(reservationDate).toLocaleDateString()}` : 'Date unknown'}
                 </p>
             </div>
             <div className="ml-auto">
                <LoadingButton
                    loading={pdfLoading}
                    onClick={async () => {
                        try {
                            setPdfLoading(true)
                            const body = { deal_id: dealId ? Number(dealId) : undefined, reservation_form_id: Number(rf.id) }
                            const { blob, filename } = await generateReservationFormPdf(body, API_URL)
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = filename
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                            notifySuccess('Reservation Form PDF generated successfully.')
                        } catch (e) {
                            notifyError(e, 'Failed to generate PDF')
                        } finally {
                            setPdfLoading(false)
                        }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none"
                >
                    <span className="material-symbols-outlined mr-2 -ml-1 text-lg">picture_as_pdf</span>
                    Download PDF
                </LoadingButton>
             </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Deal Reference</span>
                {dealId ? <Link to={`/deals/${dealId}`} className="text-lg font-semibold text-primary hover:underline">#{dealId}</Link> : <span className="text-lg font-semibold text-gray-900">-</span>}
             </div>
             <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                 <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Unit Code</span>
                 <span className="block text-lg font-semibold text-gray-900">{unitCode}</span>
             </div>
             <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                 <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Buyer Name</span>
                 <span className="block text-lg font-semibold text-gray-900 truncate" title={buyerName}>{buyerName}</span>
             </div>
             <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                 <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Reservation Date</span>
                 <span className="block text-lg font-semibold text-gray-900">
                    {reservationDate ? new Date(reservationDate).toLocaleDateString() : '-'}
                 </span>
             </div>
          </div>

          {/* Down Payment Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Down Payment Breakdown</h3>
             </div>
             <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                        <div>
                            <span className="block text-sm text-gray-500">Total Down Payment</span>
                            <span className="block text-xl font-bold text-gray-900">{dpTotal != null ? Number(dpTotal).toLocaleString() : '-'}</span>
                        </div>
                        <div>
                            <span className="block text-sm text-gray-500">Remaining</span>
                            <span className="block text-xl font-bold text-red-600">{dpRemaining != null ? Number(dpRemaining).toLocaleString() : '-'}</span>
                        </div>
                    </div>
                    
                    <div className="space-y-4 border-l border-gray-100 pl-6">
                        <div>
                            <span className="block text-sm text-gray-500">Preliminary Payment</span>
                            <span className="block text-lg font-medium text-gray-900">
                                {dpPrelim != null ? Number(dpPrelim).toLocaleString() : (prelimAmount != null ? Number(prelimAmount).toLocaleString() : '-')}
                            </span>
                            <span className="block text-xs text-gray-400 mt-1">
                                Date: {dpPrelimDate ? new Date(dpPrelimDate).toLocaleDateString() : '-'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4 border-l border-gray-100 pl-6">
                         <div>
                            <span className="block text-sm text-gray-500">Paid Amount</span>
                            <span className="block text-lg font-medium text-gray-900">{dpPaidAmount != null ? Number(dpPaidAmount).toLocaleString() : '-'}</span>
                             <span className="block text-xs text-gray-400 mt-1">
                                Date: {dpPaidDate ? new Date(dpPaidDate).toLocaleDateString() : '-'}
                            </span>
                        </div>
                    </div>
                </div>
             </div>
          </div>

          {/* Raw JSON Toggle (Collapsed by default) */}
          <details className="group bg-gray-50 rounded-lg border border-gray-200">
              <summary className="flex items-center justify-between cursor-pointer p-4">
                  <span className="text-sm font-medium text-gray-700">Debug: Raw Data Snapshot</span>
                  <span className="material-symbols-outlined text-gray-500 group-open:rotate-180 transition-transform">expand_more</span>
              </summary>
              <div className="p-4 pt-0 border-t border-gray-200 mt-2">
                  <pre className="text-xs text-gray-600 overflow-x-auto bg-gray-100 p-2 rounded">
                      {JSON.stringify(rf, null, 2)}
                  </pre>
              </div>
          </details>

        </div>
      </main>
    </div>
  )
}