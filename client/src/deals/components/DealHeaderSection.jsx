import React from 'react'
import LoadingButton from '../../components/LoadingButton.jsx'

export default function DealHeaderSection({
  deal,
  dealUnitId,
  canViewUnitHistory,
  unitDeals,
  dealStatusLabel,
  dealStatusColor,
  overrideLabel,
  overrideColor,
  unitAvailabilityLabel,
  unitStatusColor,
  autoApprovedOnBlock,
  hasPricingBreakdown,
  role,
  onBack,
  onViewUnitDeals,
  onViewUnitHistory
}) {
  if (!deal) return null

  const showUnitDealsButton = typeof dealUnitId === 'number' && dealUnitId > 0 && typeof onViewUnitDeals === 'function'
  const showUnitHistoryButton =
    typeof dealUnitId === 'number' &&
    dealUnitId > 0 &&
    !!canViewUnitHistory &&
    typeof onViewUnitHistory === 'function'

  return (
    <>
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="text-2xl font-bold text-gray-900 m-0">Deal #{deal.id}</h2>
        <div className="flex gap-2">
          <LoadingButton onClick={onBack} variant="secondary">Back to Dashboard</LoadingButton>
          {showUnitDealsButton && (
            <LoadingButton
              onClick={onViewUnitDeals}
              title="View all deals created for this unit"
              variant="secondary"
            >
              View Deals for This Unit
            </LoadingButton>
          )}
          {showUnitHistoryButton && (
            <LoadingButton
              onClick={onViewUnitHistory}
              title="Open full lifecycle history for this unit (blocks, reservations, contracts)"
              variant="secondary"
            >
              View Unit History
            </LoadingButton>
          )}
        </div>
      </div>

      <div className="mb-6">
        {/* Conflict banner: other deals for this unit */}
        {Array.isArray(unitDeals) && unitDeals.length > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-sm">
            <div className="font-semibold mb-1">
              Other deals exist for this unit: {unitDeals.length} deal(s).
            </div>
            <div className="flex flex-wrap gap-2 mb-1">
              {unitDeals.slice(0, 4).map(d => (
                <span key={d.id} className="bg-white px-1.5 py-0.5 rounded border border-orange-100 text-xs">
                  #{d.id} ({d.status || 'unknown'})
                </span>
              ))}
              {unitDeals.length > 4 && <span>…</span>}
            </div>
            <div className="text-xs opacity-75">
              This does not change this deal’s validity, but Sales/Finance should be aware of potentially
              competing offers on the same unit.
            </div>
          </div>
        )}

        <p className="text-gray-900 mb-1">
          <strong className="font-semibold">Title:</strong> {deal.title}
        </p>
        <p className="text-gray-900 mb-4">
          <strong className="font-semibold">Amount:</strong>{' '}
          {Number(deal.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>

        {/* Compact status/override/unit summary */}
        <div className="flex flex-wrap gap-4 p-3 bg-gray-50 border border-gray-100 rounded-xl mb-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Deal Status</div>
            <div>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: '#f8fafc', // Fallback if needed, but classes preferred. Using inline for dynamic color logic from parent?
                  // Actually dealStatusColor is passed as prop. Let's use style for color
                   color: dealStatusColor,
                   border: `1px solid ${dealStatusColor}20`,
                   background: `${dealStatusColor}10`
                }}
              >
                {dealStatusLabel}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Override</div>
            <div>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                 style={{
                   color: overrideColor,
                   border: `1px solid ${overrideColor}20`,
                   background: `${overrideColor}10`
                }}
              >
                {overrideLabel}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Unit Availability</div>
            <div>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
                style={{
                   color: unitStatusColor,
                   border: `1px solid ${unitStatusColor}20`,
                   background: `${unitStatusColor}10`
                }}
              >
                {unitAvailabilityLabel}
              </span>
            </div>
          </div>
        </div>
        {autoApprovedOnBlock && (
          <div className="text-xs text-gray-500 mb-4 -mt-2">
            Note: This deal was automatically marked as &quot;approved&quot; when the Financial Manager
            approved the unit block (normal criteria path, no override).
          </div>
        )}

        <p className="text-gray-900 mb-4">
          <strong className="font-semibold">Unit Type:</strong> {deal.unit_type || '-'}
        </p>
        {/* Dates summary near header */}
        <div className="flex flex-wrap gap-4 p-3 bg-stone-50 border border-stone-200 rounded-lg mb-4 text-sm">
          <div>
            <strong className="text-gray-900">Offer Date:</strong>{' '}
            {deal?.details?.calculator?.inputs?.offerDate || new Date().toISOString().slice(0, 10)}
          </div>
          <div>
            <strong className="text-gray-900">First Payment Date:</strong>{' '}
            {deal?.details?.calculator?.inputs?.firstPaymentDate ||
              deal?.details?.calculator?.inputs?.offerDate ||
              new Date().toISOString().slice(0, 10)}
          </div>
        </div>
        {!hasPricingBreakdown &&
          (role === 'property_consultant' || role === 'financial_admin' || role === 'financial_manager') && (
            <div className="mb-4 p-3 rounded-lg border border-orange-500 bg-orange-50 text-orange-900 text-sm">
              <div className="font-semibold mb-1">
                Unit price breakdown is missing from this offer snapshot.
              </div>
              <div className="opacity-90">
                Open “Edit Offer”, review the calculator, and click Save to refresh pricing before printing Client
                Offers or Reservation Forms.
              </div>
            </div>
          )}
        {deal.status === 'rejected' && deal.rejection_reason ? (
          <div className="mt-2 p-3 rounded-lg border border-red-500 bg-red-50 text-red-900">
            <strong className="font-semibold">Rejection Reason:</strong>
            <div className="mt-1">{deal.rejection_reason}</div>
          </div>
        ) : null}
        <p className="mt-4 text-sm text-gray-500">
          <strong>Created By:</strong> {deal.created_by_email || deal.created_by}
        </p>
        <p className="text-sm text-gray-500">
          <strong>Created At:</strong>{' '}
          {deal.created_at ? new Date(deal.created_at).toLocaleString() : ''}
        </p>
      </div>
    </>
  )
}