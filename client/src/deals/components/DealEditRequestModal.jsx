import React from 'react'
import LoadingButton from '../../components/LoadingButton.jsx'

export default function DealEditRequestModal({
  open,
  editFields,
  editReason,
  onChangeFields,
  onChangeReason,
  onCancel,
  onSubmit
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 w-[520px] max-w-[90vw] shadow-2xl">
        <h3 className="text-xl font-bold text-slate-900 mt-0">Request Edits From Consultant</h3>
        <p className="text-slate-500 text-sm mt-1 mb-4">
          Select the fields that need correction and optionally add a comment. Identity and unit data
          are locked after block approval.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              checked={editFields.address}
              onChange={e =>
                onChangeFields({ ...editFields, address: e.target.checked })
              }
            />
            Address
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              checked={editFields.payment_plan}
              onChange={e =>
                onChangeFields({ ...editFields, payment_plan: e.target.checked })
              }
            />
            Payment Plan
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              checked={editFields.maintenance_date}
              onChange={e =>
                onChangeFields({
                  ...editFields,
                  maintenance_date: e.target.checked
                })
              }
            />
            Maintenance Deposit Date
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              checked={editFields.offer_dates}
              onChange={e =>
                onChangeFields({ ...editFields, offer_dates: e.target.checked })
              }
            />
            Offer/First Payment Dates
          </label>
        </div>
        <div className="mt-4">
          <label className="block font-semibold text-sm text-slate-700 mb-1.5">
            Other (specify)
          </label>
          <input
            type="text"
            value={editFields.other}
            onChange={e =>
              onChangeFields({ ...editFields, other: e.target.value })
            }
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
            placeholder="e.g., POA clause text or custom note"
          />
        </div>
        <div className="mt-4">
          <label className="block font-semibold text-sm text-slate-700 mb-1.5">
            Comment
          </label>
          <textarea
            value={editReason}
            onChange={e => onChangeReason(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm min-h-[80px]"
            placeholder="Describe what needs to be changed"
          />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <LoadingButton onClick={onCancel}>Cancel</LoadingButton>
          <LoadingButton variant="primary" onClick={onSubmit}>
            Send Request
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}