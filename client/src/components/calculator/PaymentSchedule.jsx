import React from 'react'

import numberToArabic from '../../lib/numberToArabic.js'
import { t } from '../../lib/i18n.js'

function translateLabel(label, language) {
  const isAr = String(language) === 'ar'
  if (!isAr || !label) return label
  const map = {
    'Down Payment': 'الدفعة المقدمة',
    'Down Payment (Y1 split)': 'الدفعة المقدمة (تقسيم السنة الأولى)',
    'Equal Installment': 'قسط متساوي',
    'First Year': 'السنة الأولى',
    'Handover': 'التسليم',
    'Maintenance Fee': 'وديعة الصيانة',
    'Maintenance Deposit': 'وديعة الصيانة',
    'Garage Fee': 'رسوم الجراج'
  }
  if (map[label]) return map[label]

  // Year N (frequency)
  const m = String(label).match(/^Year\\s+(\\d+)\\s+\\((.+)\\)$/i)
  if (m) {
    const n = m[1]
    const freqRaw = m[2].toLowerCase()
    const freqKey = ({
      'monthly': 'monthly',
      'quarterly': 'quarterly',
      'bi-annually': 'bi_annually',
      'annually': 'annually'
    })[freqRaw] || freqRaw
    return `السنة ${n} (${t(freqKey, 'ar')})`
  }
  return label
}

export default function PaymentSchedule({ schedule = [], totals = null, language = 'en', onExportCSV, onExportXLSX, onGenerateChecks, role }) {
  const rtl = String(language) === 'ar'
  return (
    <div className="overflow-x-auto" dir={rtl ? 'rtl' : 'ltr'}>
      <table className="w-full text-sm text-left rtl:text-right text-gray-700">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3">#</th>
            <th className="px-6 py-3">{t('month', language)}</th>
            <th className="px-6 py-3">{t('date', language)}</th>
            <th className="px-6 py-3 text-center">{t('label', language)}</th>
            <th className="px-6 py-3 text-right">{t('amount_label', language)}</th>
            <th className={`px-6 py-3 ${rtl ? 'text-right' : 'text-left'}`}>{t('written_amount', language)}</th>
          </tr>
        </thead>
        <tbody>
          {(schedule || []).map((row, idx) => (
            <tr key={idx} className="bg-white border-b hover:bg-gray-50">
              <td className="px-6 py-4">{idx + 1}</td>
              <td className="px-6 py-4">{row.month}</td>
              <td className="px-6 py-4">{row.date || ''}</td>
              <td className="px-6 py-4 text-center">{translateLabel(row.label, language)}</td>
              <td className="px-6 py-4 text-right font-medium text-gray-900">
                {Number(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className={`px-6 py-4 ${rtl ? 'text-right' : 'text-left'}`}>
                {rtl ? numberToArabic(row.amount, 'جنيه مصري', 'قرش') : row.writtenAmount}
              </td>
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-200 font-bold text-gray-900">
              <td colSpan="3" className="px-6 py-4 text-right">
                {rtl ? 'الإجمالي (بدون وديعة الصيانة)' : 'Total (excluding Maintenance Deposit)'}
              </td>
              <td className="px-6 py-4 text-right">
                {Number(((totals.totalNominalExcludingMaintenance ?? totals.totalNominal)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4"></td>
            </tr>
            <tr className="bg-gray-100 border-t border-gray-200 font-bold text-gray-900">
              <td colSpan="3" className="px-6 py-4 text-right">
                {rtl ? 'الإجمالي (شامل وديعة الصيانة)' : 'Total (including Maintenance Deposit)'}
              </td>
              <td className="px-6 py-4 text-right">
                {Number(((totals.totalNominalIncludingMaintenance ?? totals.totalNominal)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4"></td>
            </tr>
          </tfoot>
        )}
      </table>
      {role === 'financial_admin' && (

        <div className={`flex gap-2 p-3 ${rtl ? 'justify-end' : 'justify-start'}`}>
          <button type="button" onClick={onExportXLSX} disabled={!schedule.length} className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
            {t('export_xlsx', language)}
          </button>
          <button type="button" onClick={onGenerateChecks} disabled={!schedule.length} className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
            {t('generate_checks_sheet', language)}
          </button>
          <button type="button" onClick={onExportCSV} disabled={!schedule.length} className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
            {t('export_csv', language)}
          </button>
        </div>
      )}

    </div>
  )
}