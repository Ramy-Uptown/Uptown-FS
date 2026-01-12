import React, { useEffect, useState } from 'react'
import { fetchWithAuth, API_URL } from '../lib/apiClient.js'
import SkeletonRow from './SkeletonRow.jsx'

function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-dashed border-gray-200">
      <div className="text-xs text-gray-500 min-w-[140px]">{label}</div>
      <div className="font-semibold text-sm text-gray-900 break-words text-right">{(value ?? '-') === '' ? '-' : String(value ?? '-')}</div>
    </div>
  )
}

function renderPayload(p) {
  try {
    const obj = typeof p === 'string' ? JSON.parse(p) : (p || {})
    const entries = Object.entries(obj)
    if (!entries.length) return '-'
    return (
      <div className="text-xs text-gray-600 space-y-1">
        {entries.map(([k, v]) => (
          <div key={k}><strong className="font-medium text-gray-700">{k}:</strong> {v == null ? 'null' : String(v)}</div>
        ))}
      </div>
    )
  } catch {
    return String(p || '-')
  }
}

export default function UnitDetailsDrawer({ unit, open, onClose }) {
  const [full, setFull] = useState(null)
  const [history, setHistory] = useState([])
  const [modelAudit, setModelAudit] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !unit) return
    let abort = false
    async function load() {
      try {
        setLoading(true)
        setError('')
        // Unit details via admin route (works for any status)
        const uResp = await fetchWithAuth(`${API_URL}/api/units/${unit.id}`)
        const uData = await uResp.json()
        let effectiveUnit = null
        if (uResp.ok) {
          effectiveUnit = uData.unit || null
          if (!abort) setFull(effectiveUnit)
        } else {
          // Fallback to inventory lookup if unavailable
          const iv = await fetchWithAuth(`${API_URL}/api/inventory/units/${unit.id}`)
          const j = await iv.json().catch(() => ({}))
          effectiveUnit = j.unit || null
          if (!abort) setFull(effectiveUnit)
        }
        // History (all statuses) for this unit
        const hResp = await fetchWithAuth(`${API_URL}/api/inventory/units/changes?status=all&unit_id=${unit.id}`)
        const hData = await hResp.json()
        if (!abort) setHistory(hResp.ok ? (hData.changes || []) : [])

        // Model audit if model_id is present
        const mid = effectiveUnit?.model_id || effectiveUnit?.model?.id
        if (mid) {
          const aResp = await fetchWithAuth(`${API_URL}/api/inventory/unit-models/${mid}/audit`)
          const aData = await aResp.json()
          if (!abort) setModelAudit(aResp.ok ? (aData.audit || []) : [])
        } else {
          if (!abort) setModelAudit([])
        }
      } catch (e) {
        if (!abort) {
          setError(e.message || String(e))
        }
      } finally {
        if (!abort) setLoading(false)
      }
    }
    load()
    return () => { abort = true }
  }, [open, unit?.id])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] overflow-hidden">
      <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md md:max-w-xl bg-white shadow-xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Unit Details</h3>
                <button 
                    onClick={onClose} 
                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="flex-1 px-6 py-6 space-y-8">
                {error && (
                    <div className="rounded-md bg-red-50 p-4">
                        <div className="flex">
                            <span className="material-symbols-outlined text-red-400 mr-2">error</span>
                            <div className="text-sm text-red-700">{error}</div>
                        </div>
                    </div>
                )}

                <section>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Summary</h4>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        {!full && loading ? (
                            <div className="space-y-3">
                                <SkeletonRow widths={['lg']} tdStyle={{ padding: 0 }} />
                                <SkeletonRow widths={['md']} tdStyle={{ padding: 0 }} />
                                <SkeletonRow widths={['lg']} tdStyle={{ padding: 0 }} />
                            </div>
                        ) : (
                            <>
                                <Field label="ID" value={unit?.id} />
                                <Field label="Code" value={full?.code || unit?.code} />
                                <Field label="Status" value={full?.unit_status || unit?.unit_status} />
                                <Field label="Model" value={full?.model_code ? `${full.model_code} — ${full.model_name || ''}` : (full?.model_name || '-')} />
                                <Field label="Area (m²)" value={full?.area} />
                                <Field label="Unit No." value={full?.unit_number} />
                                <Field label="Floor" value={full?.floor} />
                                <Field label="Building" value={full?.building_number} />
                                <Field label="Block/Sector" value={full?.block_sector} />
                                <Field label="Zone" value={full?.zone} />
                                <Field label="Garden" value={(full?.garden_available ? `Yes (${Number(full?.garden_area || 0)} m²)` : 'No')} />
                                <Field label="Roof" value={(full?.roof_available ? `Yes (${Number(full?.roof_area || 0)} m²)` : 'No')} />
                                <Field label="Currency" value={full?.currency || 'EGP'} />
                                <Field label="Total (excl. maint.)" value={Number(full?.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
                            </>
                        )}
                    </div>
                </section>

                <section>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Change History</h4>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payload</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading && (
                                    <tr><td colSpan={4} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                                )}
                                {!loading && history.map(ch => (
                                    <tr key={ch.id}>
                                        <td className="px-3 py-2 text-xs text-gray-900 font-medium">{ch.action}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{ch.status}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{(ch.created_at || '').slice(0, 10)}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500 max-w-[150px] truncate hover:whitespace-normal hover:bg-gray-50 z-10 relative">
                                            {renderPayload(ch.payload)}
                                        </td>
                                    </tr>
                                ))}
                                {!loading && history.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400 italic">No history for this unit.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Model Audit</h4>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                         <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">By</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading && (
                                    <tr><td colSpan={4} className="px-3 py-4"><SkeletonRow widths={['lg']} /></td></tr>
                                )}
                                {!loading && modelAudit.map(a => (
                                    <tr key={a.id}>
                                        <td className="px-3 py-2 text-xs text-gray-900 font-medium">{a.action}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{a.changed_by_email || a.changed_by || '-'}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{(a.created_at || '').slice(0, 10)}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500 max-w-[150px] truncate hover:whitespace-normal hover:bg-gray-50 z-10 relative">
                                            {renderPayload(a.details)}
                                        </td>
                                    </tr>
                                ))}
                                {!loading && modelAudit.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400 italic">No model audit records.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

        </div>
      </div>
    </div>
  )
}