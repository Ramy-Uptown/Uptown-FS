import React from 'react'

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center text-xs text-gray-600">
      <span className="opacity-80">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  )
}

/**
 * UnitCard — shows a single unit with compact or expanded details.
 * Props:
 * - unit
 * - mode: 'compact' | 'expanded'
 * - onCreateOffer: (unit) => void
 */
export function UnitCard({ unit, mode = 'compact', onCreateOffer }) {
  const isBlocked = String(unit.unit_status || '').toUpperCase() === 'BLOCKED'

  const modelLabel = unit.model_code ? `${unit.model_code} — ${unit.model_name || ''}`.trim() : (unit.model_name || '')
  const gardenLabel = unit.garden_available ? `Yes (${Number(unit.garden_area || 0).toLocaleString()} m²)` : 'No'
  const roofLabel = unit.roof_available ? `Yes (${Number(unit.roof_area || 0).toLocaleString()} m²)` : 'No'
  const totalExclMaint = Number(unit.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })

  const statusLabel = unit.unit_status || ''
  const statusUpper = statusLabel.toString().toUpperCase()
  const isAvailable = statusUpper === 'AVAILABLE'

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow overflow-hidden">
      {isBlocked && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.08] z-0">
          <div className="px-10 py-2 rounded-full border-2 border-red-600 text-red-600 font-extrabold tracking-[0.2em] text-2xl -rotate-12 uppercase">
            Blocked
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-baseline z-10 relative">
        <div>
          <div className="font-bold text-gray-900 text-lg">{unit.code}</div>
          <div className="text-xs text-gray-500">{unit.unit_type_name || unit.unit_type || ''} • {modelLabel || '-'}</div>
        </div>
        <div className="font-bold text-primary text-base">
          {totalExclMaint} {unit.currency || 'EGP'}
        </div>
      </div>

      {/* Core facts */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 z-10 relative">
        <InfoRow label="Area" value={unit.area ? `${Number(unit.area).toLocaleString()} m²` : '-'} />
        <InfoRow label="Orientation" value={unit.orientation || '-'} />
        <InfoRow label="Garden" value={gardenLabel} />
        <InfoRow label="Roof" value={roofLabel} />
      </div>

      {/* Expanded: price breakdown */}
      {mode === 'expanded' && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-gray-100 z-10 relative">
          <InfoRow label="Base" value={Number(unit.base_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
          <InfoRow label="Garden Pay" value={Number(unit.garden_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
          <InfoRow label="Roof Pay" value={Number(unit.roof_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
          <InfoRow label="Storage" value={Number(unit.storage_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
          <InfoRow label="Garage Pay" value={Number(unit.garage_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
          <InfoRow label="Maint." value={Number(unit.maintenance_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
        </div>
      )}

      <div className="flex justify-between items-center pt-2 mt-auto z-10 relative">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Status: <span className={isAvailable ? 'text-green-600' : isBlocked ? 'text-red-600' : 'text-blue-600'}>{statusLabel || '-'}</span></span>
        {typeof onCreateOffer === 'function' ? (
          <button
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary transition-colors
              ${isBlocked 
                 ? 'border-red-200 text-red-700 bg-red-50 opacity-60 cursor-not-allowed' 
                 : 'border-gray-200 text-primary bg-white hover:bg-primary/5 hover:border-primary/30'
              }`}
            onClick={() => {
              if (isBlocked) return
              onCreateOffer(unit)
            }}
            disabled={isBlocked}
          >
            Create Offer
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * UnitCardsGrid — renders a grid of UnitCard components.
 * Props:
 * - units
 * - onCreateOffer
 * - mode: 'compact' | 'expanded'
 */
export function UnitCardsGrid({ units, onCreateOffer, mode = 'compact' }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {(units || []).map(u => (
        <UnitCard key={u.id} unit={u} onCreateOffer={onCreateOffer} mode={mode} />
      ))}
      {(units || []).length === 0 && (
        <div className="col-span-full text-center text-gray-500 text-sm py-8">No units found.</div>
      )}
    </div>
  )
}

export default UnitCard