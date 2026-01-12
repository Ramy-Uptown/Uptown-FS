import React from 'react'

/**
 * UnitDetailsTable
 * Renders a detailed table of inventory units with pricing breakdown and features.
 *
 * Props:
 * - units: Array of unit objects as returned by /api/inventory/units
 * - loading: boolean (optional)
 * - onCreateOffer: function(unit) -> void (optional) called when Create Offer is clicked
 * - mode: 'compact' | 'expanded' (optional, default 'expanded')
 */
export default function UnitDetailsTable({ units, loading = false, onCreateOffer, mode = 'expanded' }) {
  const isExpanded = mode === 'expanded'

  return (
    <div className="overflow-x-auto min-h-[400px]">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">ID</th>
            <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
            <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
            <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Model</th>
            <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Area (m²)</th>
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Orientation</th>}
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garden</th>}
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Roof</th>}
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Garage</th>}
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Base</th>}
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Garden Pay</th>}
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Roof Pay</th>}
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Storage</th>}
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Garage Pay</th>}
            {isExpanded && <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Maintenance</th>}
            <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Total (ex. maint)</th>
            <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Currency</th>
            <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {(units || []).map(u => {
            const gardenLabel = u.garden_available ? `Yes (${Number(u.garden_area || 0).toLocaleString()} m²)` : 'No'
            const roofLabel = u.roof_available ? `Yes (${Number(u.roof_area || 0).toLocaleString()} m²)` : 'No'
            const garageLabel = (Number(u.garage_area || 0) > 0) ? `Yes (${Number(u.garage_area || 0).toLocaleString()} m²)` : 'No'
            const modelLabel = u.model_code ? `${u.model_code} — ${u.model_name || ''}`.trim() : (u.model_name || '')
            const statusLabel = u.unit_status || ''
            const statusUpper = statusLabel.toString().toUpperCase()
            const isBlocked = statusUpper === 'BLOCKED'
            const isAvailable = statusUpper === 'AVAILABLE'

            let statusClasses = "bg-gray-100 text-gray-800"
            if (isAvailable) statusClasses = "bg-green-100 text-green-800"
            else if (isBlocked) statusClasses = "bg-red-100 text-red-800"
            else if (statusUpper) statusClasses = "bg-blue-100 text-blue-800"

            return (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{u.id}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">{u.code}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.unit_type_name || u.unit_type || ''}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 max-w-[200px] truncate" title={modelLabel || `#${u.model_id}`}>{modelLabel || (u.model_id ? `#${u.model_id}` : '-')}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">{u.area ? Number(u.area).toLocaleString() : '-'}</td>
                
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.orientation || '-'}</td>}
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{gardenLabel}</td>}
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{roofLabel}</td>}
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{garageLabel}</td>}
                
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">{Number(u.base_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">{Number(u.garden_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">{Number(u.roof_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">{Number(u.storage_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">{Number(u.garage_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                {isExpanded && <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">{Number(u.maintenance_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right font-semibold font-mono">{Number(u.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.currency || 'EGP'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                   <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${statusClasses}`}>
                      {statusLabel || '-'}
                   </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {typeof onCreateOffer === 'function' ? (
                    <button
                      onClick={() => {
                        if (isBlocked) return
                        onCreateOffer(u)
                      }}
                      disabled={isBlocked}
                      className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${isBlocked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-primary bg-primary/10 hover:bg-primary/20'}`}
                    >
                      Create Offer
                    </button>
                  ) : null}
                </td>
              </tr>
            )
          })}
          {(units || []).length === 0 && !loading && (
            <tr>
              <td colSpan={isExpanded ? 20 : 12} className="px-3 py-8 text-center text-sm text-gray-500">
                No units found.
              </td>
            </tr>
          )}
          {loading && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                   <td className="py-4 pl-4 pr-3 sm:pl-6"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                   <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                   <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                   <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                   <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div></td>
                   {isExpanded && <td colSpan={10} className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-full"></div></td>}
                    <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-24 ml-auto"></div></td>
                   <td className="px-3 py-4"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                   <td className="px-3 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                   <td className="px-3 py-4 text-right"><div className="h-8 bg-gray-200 rounded w-20 ml-auto"></div></td>
                </tr>
             ))
          )}
        </tbody>
      </table>
    </div>
  )
}