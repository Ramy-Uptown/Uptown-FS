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
    <div style={{ ...styles.blockFull, border: '1px solid #eef2f7', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>First Year Payments</h3>
        <button type="button" onClick={addFirstYearPayment} style={styles.btn}>+ Add Payment</button>
      </div>
      {firstYearPayments.length === 0 ? (
        <p style={styles.metaText}>No first-year payments defined.</p>
      ) : (
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}>
          {firstYearPayments.map((p, idx) => {
            const errAmt = errors[`fyp_amount_${idx}`]
            const errMonth = errors[`fyp_month_${idx}`]
            return (
              <React.Fragment key={idx}>
                <div>
                  <label style={styles.label}>Amount</label>
                  <input type="number" value={p.amount} onChange={e => updateFirstYearPayment(idx, 'amount', e.target.value)} style={styles.input(errAmt)} />
                  {errAmt && <small style={styles.error}>{errAmt}</small>}
                </div>
                <div>
                  <label style={styles.label}>Month (1-12)</label>
                  <input type="number" min="1" max="12" value={p.month} onChange={e => updateFirstYearPayment(idx, 'month', e.target.value)} style={styles.input(errMonth)} />
                  {language === 'ar' && <small style={{...styles.metaText, fontStyle: 'italic'}}>{getArabicMonth(p.month)}</small>}
                  {errMonth && <small style={styles.error}>{errMonth}</small>}
                </div>
                <div>
                  <label style={styles.label}>Type</label>
                  <select value={p.type} onChange={e => updateFirstYearPayment(idx, 'type', e.target.value)} style={styles.select()}>
                    <option value="dp">dp</option>
                    <option value="regular">regular</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'end' }}>
                  <button type="button" onClick={() => removeFirstYearPayment(idx)} style={styles.btn}>Remove</button>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}