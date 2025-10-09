import React from 'react'
import { tableWrap as wrapDefault, table as tableDefault, th as thDefault, td as tdDefault } from '../../lib/ui.js'
import numberToArabic from '../../lib/numberToArabic.js'

export default function PaymentSchedule({ schedule = [], totals = null, language = 'en', onExportCSV, onExportXLSX, onGenerateChecks }) {
  return (
    <div style={wrapDefault}>
      <table style={tableDefault}>
        <thead>
          <tr>
            <th style={thDefault}>#</th>
            <th style={thDefault}>Month</th>
            <th style={thDefault}>Date</th>
            <th style={thDefault}>Label</th>
            <th style={{ ...thDefault, textAlign: 'right' }}>Amount</th>
            <th style={{ ...thDefault, textAlign: language === 'ar' ? 'right' : 'left' }}>Written Amount</th>
          </tr>
        </thead>
        <tbody>
          {(schedule || []).map((row, idx) => (
            <tr key={idx}>
              <td style={tdDefault}>{idx + 1}</td>
              <td style={tdDefault}>{row.month}</td>
              <td style={tdDefault}>{row.date || ''}</td>
              <td style={tdDefault}>{row.label}</td>
              <td style={{ ...tdDefault, textAlign: 'right' }}>
                {Number(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ ...tdDefault, direction: language === 'ar' ? 'rtl' : 'ltr', textAlign: language === 'ar' ? 'right' : 'left' }}>
                {language === 'ar' ? numberToArabic(row.amount, 'جنيه مصري', 'قرش') : row.writtenAmount}
              </td>
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr>
              <td colSpan="3" style={{ padding: 12, fontWeight: 700, background: '#fbfaf7', textAlign: 'right' }}>Total</td>
              <td style={{ padding: 12, fontWeight: 700, background: '#fbfaf7', textAlign: 'right' }}>
                {Number(totals.totalNominal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: 12, fontWeight: 700, background: '#fbfaf7' }}></td>
            </tr>
          </tfoot>
        )}
      </table>
      <div style={{ display: 'flex', gap: 8, padding: 10 }}>
        <button type="button" onClick={onExportXLSX} disabled={!schedule.length} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }}>
          Export to Excel (.xlsx)
        </button>
        <button type="button" onClick={onGenerateChecks} disabled={!schedule.length} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }}>
          Generate Checks Sheet (.xlsx)
        </button>
        <button type="button" onClick={onExportCSV} disabled={!schedule.length} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d9e6', background: '#fff', cursor: 'pointer' }}>
          Export to CSV
        </button>
      </div>
    </div>
  )
}