import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import { notifyError, notifySuccess } from '../lib/notifications.js'
import AdminSidebar from '../components/AdminSidebar.jsx'
import LoadingButton from '../components/LoadingButton.jsx'
import SkeletonRow from '../components/SkeletonRow.jsx'

export default function ContractDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState(null)
  const [deal, setDeal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [dpSummary, setDpSummary] = useState(null)
  const [dpSummaryError, setDpSummaryError] = useState('')
  
  // Preview feature state
  const [showDataPreview, setShowDataPreview] = useState(false)

  const [role, setRole] = useState('')
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('auth_user') || '{}')
      setRole(u?.role || 'user')
    } catch {}
  }, [])

  // Contract configuration state
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0])
  
  // POA multi-field state (4 separate inputs)
  const [poaNumber, setPoaNumber] = useState('')
  const [poaLetter, setPoaLetter] = useState('')
  const [poaYear, setPoaYear] = useState('')
  const [poaOffice, setPoaOffice] = useState('')
  
  // Unlock request state
  const [pendingUnlockRequest, setPendingUnlockRequest] = useState(null)

  async function load() {
    try {
      setLoading(true)
      setError('')
      const resp = await fetchWithAuth(`${API_URL}/api/contracts/${id}`)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to load contract')
      
      const c = data.contract || data
      setContract(c)

      // Load financial summary when we know deal_id
      const dealIdNum = Number(c.deal_id || 0)
      if (dealIdNum) {
        try {
          setDpSummaryError('')
          const sResp = await fetchWithAuth(`${API_URL}/api/deals/${dealIdNum}/financial-summary`)
          const sData = await sResp.json().catch(() => null)
          if (!sResp.ok) {
            setDpSummary(null)
            setDpSummaryError(sData?.error?.message || 'Failed to load financial summary')
          } else {
            setDpSummary(sData?.summary || null)
          }
        } catch (e) {
          setDpSummary(null)
          setDpSummaryError(e?.message || String(e))
        }
      } else {
        setDpSummary(null)
        setDpSummaryError('')
      }

      // Load Deal details (for contract settings)
      if (dealIdNum) {
        try {
          const dResp = await fetchWithAuth(`${API_URL}/api/deals/${dealIdNum}`)
          const dData = await dResp.json().catch(() => null)
          if (dResp.ok && dData?.deal) {
            setDeal(dData.deal)
          }
        } catch (e) {
          console.error('Failed to load deal', e)
        }
      }
    } catch (e) {
      const msg = e.message || String(e)
      setError(msg)
      notifyError(msg, 'Failed to load contract')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  // Sync state when deal is loaded (if existing settings found)
  useEffect(() => {
    if (deal) {
      if (deal.contract_date) {
        setContractDate(deal.contract_date.split('T')[0])
      }
      // Load 4 POA fields
      if (deal.poa_number) setPoaNumber(deal.poa_number)
      if (deal.poa_letter) setPoaLetter(deal.poa_letter)
      if (deal.poa_year) setPoaYear(deal.poa_year)
      if (deal.poa_office) setPoaOffice(deal.poa_office)
      
      // Check for pending unlock request
      if (deal.contract_settings_locked) {
        fetchWithAuth(`${API_URL}/api/deals/${deal.id}/settings-unlock-request`)
          .then(r => r.json())
          .then(d => setPendingUnlockRequest(d?.request || null))
          .catch(() => setPendingUnlockRequest(null))
      } else {
        setPendingUnlockRequest(null)
      }
    }
  }, [deal])

  if (loading && !contract) {
    return <div className="flex h-screen bg-gray-50"><AdminSidebar role={role} /><div className="flex-1 p-6"><SkeletonRow /></div></div>
  }

  if (error && !contract) {
    return <div className="flex h-screen bg-gray-50"><AdminSidebar role={role} /><div className="flex-1 p-6 text-red-600">{error}</div></div>
  }

  if (!contract) {
    return <div className="flex h-screen bg-gray-50"><AdminSidebar role={role} /><div className="flex-1 p-6">No contract found.</div></div>
  }

  const status = String(contract.status || '').toUpperCase()
  const dealId = contract.deal_id || null
  const reservationFormId = contract.reservation_form_id || null
  const unitCode = contract.unit_code || contract.unit?.unit_code || '-'
  const buyerName = contract.buyer_name || contract.buyer || contract.client_name || '-'
  const createdAt = contract.created_at ? new Date(contract.created_at).toLocaleString() : '-'
  const updatedAt = contract.updated_at ? new Date(contract.updated_at).toLocaleString() : '-'

  const clientInfo = contract.client_info || contract.details?.clientInfo || {}
  const unitInfo = contract.unit_info || contract.details?.calculator?.unitInfo || {}
  const handoverYear = contract.handover_year || contract.details?.calculator?.inputs?.handoverYear || null

  const canSubmitToCm = role === 'contract_person' && status === 'DRAFT' && !!dealId
  // const canPreviewDraft = role === 'contract_person' && status === 'DRAFT' && !!dealId

  // Build the contract data for preview panel
  const calculatorData = contract.details?.calculator || {}
  const generatedPlan = calculatorData.generatedPlan || {}
  const inputs = calculatorData.inputs || {}
  const totalPrice = dpSummary?.total_excl || dpSummary?.total_price || generatedPlan.totalNominal || contract.amount || null
  const planDuration = inputs.planDurationYears || dpSummary?.plan_duration_years || null
  const frequency = inputs.installmentFrequency || dpSummary?.installment_frequency || null

  const contractDataFields = [
    { label: 'Buyer Name', value: clientInfo.buyer_name || buyerName },
    { label: 'Nationality', value: clientInfo.nationality || '-' },
    { label: 'ID/Passport', value: clientInfo.id_or_passport || '-' },
    { label: 'Phone', value: clientInfo.phone_primary || '-' },
    { label: 'Email', value: clientInfo.email || '-' },
    { label: 'Address', value: clientInfo.address || '-' },
    { label: 'Unit Code', value: unitCode },
    { label: 'Unit Type', value: unitInfo.unit_type || '-' },
    { label: 'Unit Area', value: unitInfo.unit_area || unitInfo.area || '-' },
    { label: 'Building / Block', value: `${unitInfo.building_number || '-'} / ${unitInfo.block_sector || '-'}` },
    { label: 'Total Price', value: totalPrice ? Number(totalPrice).toLocaleString() : '-' },
    { label: 'Down Payment', value: dpSummary?.dp_total ? Number(dpSummary.dp_total).toLocaleString() : (generatedPlan.downPaymentAmount ? Number(generatedPlan.downPaymentAmount).toLocaleString() : '-') },
    { label: 'Handover Year', value: handoverYear ? `Year ${handoverYear}` : '-' },
    { label: 'Plan Duration', value: planDuration ? `${planDuration} years` : '-' },
    { label: 'Installment Frequency', value: frequency || '-' }
  ]

  // Action handlers
  const handleUpdateStatus = async (newStatus) => {
    if (!confirm(`Are you sure you want to update status to ${newStatus}?`)) return
    try {
      setActionLoading(true)
      const res = await fetchWithAuth(`${API_URL}/api/contracts/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) throw new Error('Failed to update status')
      notifySuccess(`Status updated to ${newStatus}`)
      load()
    } catch (e) {
      notifyError(e, 'Update failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar role={role} />
      
      <main className="flex-1 overflow-y-auto ml-0 md:ml-64 lg:ml-0 p-6">
        <div className="w-full mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center gap-4">
             <button
                onClick={() => navigate('/contracts')}
                className="bg-white border border-gray-300 rounded-full p-2 hover:bg-gray-50 text-gray-500 transition-colors"
             >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
             </button>
             <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-display font-bold text-primary tracking-wide">Contract #{contract.id}</h2>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                        ${status === 'APPROVED' || status === 'EXECUTED' ? 'bg-green-100 text-green-800' : 
                          status.includes('PENDING') ? 'bg-blue-100 text-blue-800' : 
                          status === 'REJECTED' ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                        {status.replace('_', ' ')}
                    </span>
                 </div>
                 <p className="text-sm text-gray-500 mt-1">Created on {createdAt} • Last updated {updatedAt}</p>
             </div>
             
             <div className="ml-auto flex gap-3">
                 {/* Workflow Actions */}
                 {canSubmitToCm && (
                     <LoadingButton 
                        onClick={() => handleUpdateStatus('pending_cm')}
                        loading={actionLoading}
                        className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium"
                     >
                        Submit to CM
                     </LoadingButton>
                 )}
                 {/* Add other role-based actions as needed */}
             </div>
          </div>

          {/* Quick Links Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap gap-6 text-sm">
             <div>
                <span className="block text-xs text-gray-500 uppercase tracking-wider font-semibold">Deal Reference</span>
                {dealId ? <Link to={`/deals/${dealId}`} className="text-primary hover:underline font-medium">#{dealId}</Link> : '-'}
             </div>
             <div>
                <span className="block text-xs text-gray-500 uppercase tracking-wider font-semibold">Reservation Form</span>
                {reservationFormId ? <Link to={`/reservation-forms/${reservationFormId}`} className="text-primary hover:underline font-medium">#{reservationFormId}</Link> : '-'}
             </div>
             <div>
                <span className="block text-xs text-gray-500 uppercase tracking-wider font-semibold">Unit</span>
                <span className="font-medium text-gray-900">{unitCode}</span>
             </div>
             <div>
                <span className="block text-xs text-gray-500 uppercase tracking-wider font-semibold">Buyer</span>
                <span className="font-medium text-gray-900">{buyerName}</span>
             </div>
          </div>

          {/* Summaries Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Buyer Summary */}
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Buyer Summary</h3>
                <dl className="space-y-3 text-sm">
                   <div className="flex justify-between">
                      <dt className="text-gray-500">Name</dt>
                      <dd className="font-medium text-gray-900">{clientInfo?.buyer_name || buyerName || '-'}</dd>
                   </div>
                   <div className="flex justify-between">
                      <dt className="text-gray-500">ID / Passport</dt>
                      <dd className="font-medium text-gray-900">{clientInfo?.id_or_passport || '-'}</dd>
                   </div>
                   <div className="flex justify-between">
                      <dt className="text-gray-500">Phone</dt>
                      <dd className="font-medium text-gray-900">{clientInfo?.phone_primary || '-'}</dd>
                   </div>
                   <div className="flex justify-between">
                      <dt className="text-gray-500">Address</dt>
                      <dd className="font-medium text-gray-900 text-right max-w-[200px] truncate" title={clientInfo?.address}>{clientInfo?.address || '-'}</dd>
                   </div>
                </dl>
             </div>

             {/* Unit Summary */}
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Unit Summary</h3>
                <dl className="space-y-3 text-sm">
                   <div className="flex justify-between">
                      <dt className="text-gray-500">Unit Type</dt>
                      <dd className="font-medium text-gray-900">{unitInfo?.unit_type || '-'}</dd>
                   </div>
                   <div className="flex justify-between">
                      <dt className="text-gray-500">Area</dt>
                      <dd className="font-medium text-gray-900">{unitInfo?.unit_area || unitInfo?.area || '-'} m²</dd>
                   </div>
                   <div className="flex justify-between">
                      <dt className="text-gray-500">Location</dt>
                      <dd className="font-medium text-gray-900 text-right">{unitInfo?.building_number || '-'} / {unitInfo?.block_sector || '-'} / {unitInfo?.zone || '-'}</dd>
                   </div>
                   <div className="flex justify-between">
                      <dt className="text-gray-500">Handover</dt>
                      <dd className="font-medium text-gray-900">{handoverYear ? `Year ${handoverYear}` : '-'}</dd>
                   </div>
                </dl>
             </div>
          </div>

          {/* Contract Settings Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
             <div className="flex items-center justify-between mb-4 border-b pb-2">
                <h3 className="text-lg font-medium text-gray-900">Contract Settings (إعدادات العقد)</h3>
                {deal?.contract_settings_locked && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                       <span className="material-symbols-outlined text-sm mr-1">lock</span> Locked
                    </span>
                )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contract Date (تاريخ العقد)</label>
                    <input 
                      type="date"
                      value={contractDate}
                      onChange={e => setContractDate(e.target.value)}
                      disabled={deal?.contract_settings_locked}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    />
                 </div>
             </div>

             <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Power of Attorney (بيان التوكيل)</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {[
                      { l: 'رقم التوكيل', v: poaNumber, s: setPoaNumber, p: '12345' },
                      { l: 'حرف التوكيل', v: poaLetter, s: setPoaLetter, p: 'ك' },
                      { l: 'سنة التوكيل', v: poaYear, s: setPoaYear, p: '2025' },
                      { l: 'مكتب توثيق', v: poaOffice, s: setPoaOffice, p: 'الدقي' },
                   ].map((f, i) => (
                      <div key={i}>
                         <label className="block text-xs text-gray-500 mb-1 text-right">{f.l}</label>
                         <input 
                            type="text"
                            value={f.v}
                            onChange={e => f.s(e.target.value)}
                            placeholder={f.p}
                            disabled={deal?.contract_settings_locked}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm text-center disabled:bg-gray-100" 
                            dir="rtl"
                         />
                      </div>
                   ))}
                </div>
                {(poaNumber || poaLetter || poaYear || poaOffice) && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded-md border border-yellow-200 text-right text-sm text-yellow-800">
                       <strong>معاينة: </strong> والوكالة رقم {poaNumber} حرف {poaLetter} لسنة {poaYear} مكتب توثيق {poaOffice}
                    </div>
                )}
             </div>

             <div className="flex items-center gap-3">
                {!deal?.contract_settings_locked && (
                    <>
                       <LoadingButton
                          onClick={async () => {
                             try {
                                const res = await fetch(`${API_URL}/api/deals/${dealId}/contract-settings`, {
                                   method: 'PUT',
                                   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
                                   body: JSON.stringify({ contractDate, poaNumber, poaLetter, poaYear, poaOffice })
                                })
                                if (res.ok) { notifySuccess('Settings saved'); load(); } 
                                else notifyError('Failed to save settings')
                             } catch (e) { notifyError(e, 'Error saving settings') }
                          }}
                          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md shadow-sm text-sm font-medium"
                       >
                          Save Settings
                       </LoadingButton>
                       <LoadingButton
                          onClick={async () => {
                             if (!confirm('Lock settings? Cannot be changed afterwards.')) return
                             try {
                                const res = await fetch(`${API_URL}/api/deals/${dealId}/lock-contract-settings`, {
                                   method: 'POST',
                                   headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
                                })
                                if (res.ok) { notifySuccess('Settings locked'); load(); }
                                else notifyError('Failed to lock settings')
                             } catch (e) { notifyError(e, 'Error locking') }
                          }}
                          className="bg-red-600 border border-transparent text-white hover:bg-red-700 px-4 py-2 rounded-md shadow-sm text-sm font-medium"
                       >
                          Lock Settings
                       </LoadingButton>
                    </>
                )}
                {deal?.contract_settings_locked && (
                   <div className="flex items-center gap-2 text-sm">
                      {pendingUnlockRequest ? (
                         <span className="text-yellow-600 font-medium">⏳ Unlock Requested</span>
                      ) : (
                         <span className="text-gray-500 italic">Settings are locked. Contact manager to unlock.</span>
                      )}
                   </div>
                )}
             </div>
          </div>

          {/* Data Preview Toggle */}
             <div>
                <button
                   onClick={() => setShowDataPreview(!showDataPreview)}
                   className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover focus:outline-none"
                >
                   <span>{showDataPreview ? 'Hide Contract Data' : 'View Contract Data used in Verification'}</span>
                   <span className="material-symbols-outlined text-lg">{showDataPreview ? 'expand_less' : 'expand_more'}</span>
                </button>
                {showDataPreview && (
                   <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {contractDataFields.map((f, i) => (
                         <div key={i} className="bg-white p-2 rounded border border-gray-100 flex justify-between text-xs">
                            <span className="text-gray-500 font-medium">{f.label}</span>
                            <span className="text-gray-900">{f.value}</span>
                         </div>
                      ))}
                   </div>
                )}
             </div>

        </div>
      </main>
    </div>
  )
}