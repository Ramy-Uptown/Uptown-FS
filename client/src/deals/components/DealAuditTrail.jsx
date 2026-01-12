import React from 'react'

export default function DealAuditTrail({ history, expandedNotes, onToggleNote }) {
  const rows = Array.isArray(history) ? history : []

  return (
    <>
      <h3 className="text-lg font-semibold mb-3">Audit Trail</h3>
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-3 border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50">#</th>
              <th className="text-left p-3 border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50">Action</th>
              <th className="text-left p-3 border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50">User</th>
              <th className="text-left p-3 border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50">Notes</th>
              <th className="text-left p-3 border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h, idx) => (
              <tr key={h.id}>
                <td className="p-3 border-b border-slate-100 text-sm align-top">{idx + 1}</td>
                <td className="p-3 border-b border-slate-100 text-sm align-top">{h.action}</td>
                <td className="p-3 border-b border-slate-100 text-sm align-top">{h.user_email || h.user_id}</td>
                <td className="p-3 border-b border-slate-100 text-sm align-top">
                  {(() => {
                    const raw = h.notes || ''
                    let parsed = null
                    try {
                      if (typeof raw === 'string' && raw.trim().startsWith('{')) {
                        parsed = JSON.parse(raw)
                      }
                    } catch {
                      // ignore parse errors and fall back to raw text
                    }
                    if (!parsed) return raw
                    const isAuto = parsed.event === 'auto_commission'
                    const sum = isAuto
                      ? `Auto commission — Policy: ${
                          parsed?.policy?.name || parsed?.policy?.id || ''
                        }, Amount: ${Number(parsed?.amounts?.commission || 0).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2 }
                        )}`
                      : 'Details'
                    const open = !!expandedNotes[h.id]
                    return (
                      <div>
                        <div className="flex gap-2 items-center flex-wrap">
                          <span>{sum}</span>
                          <button
                            type="button"
                            onClick={() => onToggleNote && onToggleNote(h.id)}
                            className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium transition-colors"
                          >
                            {open ? 'Hide' : 'Show'} JSON
                          </button>
                        </div>
                        {open && (
                          <pre className="bg-slate-50 p-2 rounded-md border border-slate-200 mt-1.5 max-w-2xl overflow-auto text-xs font-mono">
                            {JSON.stringify(parsed, null, 2)}
                          </pre>
                        )}
                      </div>
                    )
                  })()}
                </td>
                <td className="p-3 border-b border-slate-100 text-sm align-top whitespace-nowrap">
                  {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-3 border-b border-slate-100 text-sm text-center text-slate-500" colSpan={5}>
                  No history yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}