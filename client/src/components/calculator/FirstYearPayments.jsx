import React from 'react'
import { getArabicMonth } from '../../lib/i18n.js'

export default function FirstYearPayments({
  styles,
  language,
  firstYearPayments,
  errors,
  addFirstYearPayment,
  updateFirstYearPayment,
  removeFirstYearPayment
}) {
  return (
    <div className={`${styles.blockFull} border border-gray-200 rounded-lg p-3`}>
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold">First Year Payments</h3>
        <button type="button" onClick={addFirstYearPayment} className={styles.btn}>+ Add Payment</button>
      </div>
      {firstYearPayments.length === 0 ? (
        <p className={styles.metaText}>No first-year payments defined.</p>
      ) : (
        <div className="mt-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
          {firstYearPayments.map((p, idx) => {
            const errAmt = errors[`fyp_amount_${idx}`]
            const errMonth = errors[`fyp_month_${idx}`]
            return (
              <React.Fragment key={idx}>
                <div>
                  <label className={styles.label}>Amount</label>
                  <input type="number" value={p.amount} onChange={e => updateFirstYearPayment(idx, 'amount', e.target.value)} className={`${styles.input} ${errAmt ? 'border-red-500' : ''}`} />
                  {errAmt && <small className={styles.error}>{errAmt}</small>}
                </div>
                <div>
                  <label className={styles.label}>Month (1-12)</label>
                  <input type="number" min="1" max="12" value={p.month} onChange={e => updateFirstYearPayment(idx, 'month', e.target.value)} className={`${styles.input} ${errMonth ? 'border-red-500' : ''}`} />
                  {language === 'ar' && <small className={`${styles.metaText} italic`}>{getArabicMonth(p.month)}</small>}
                  {errMonth && <small className={styles.error}>{errMonth}</small>}
                </div>
                <div>
                  <label className={styles.label}>Type</label>
                  <select value={p.type} onChange={e => updateFirstYearPayment(idx, 'type', e.target.value)} className={styles.select}>
                    <option value="dp">dp</option>
                    <option value="regular">regular</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={() => removeFirstYearPayment(idx)} className={styles.btn}>Remove</button>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}