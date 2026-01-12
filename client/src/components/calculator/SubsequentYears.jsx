import React from 'react'

export default function SubsequentYears({
  styles,
  subsequentYears,
  errors,
  addSubsequentYear,
  updateSubsequentYear,
  removeSubsequentYear
}) {
  return (
    <div className={`${styles.blockFull} border border-gray-200 rounded-lg p-3`}>
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold">Subsequent Custom Years</h3>
        <button type="button" onClick={addSubsequentYear} className={styles.btn}>+ Add Year</button>
      </div>
      {subsequentYears.length === 0 ? (
        <p className={styles.metaText}>No subsequent custom years defined.</p>
      ) : (
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
          {subsequentYears.map((y, idx) => {
            const errTot = errors[`sub_total_${idx}`]
            const errFreq = errors[`sub_freq_${idx}`]
            return (
              <React.Fragment key={idx}>
                <div>
                  <label className={styles.label}>Total Nominal</label>
                  <input type="number" value={y.totalNominal} onChange={e => updateSubsequentYear(idx, 'totalNominal', e.target.value)} className={`${styles.input} ${errTot ? 'border-red-500' : ''}`} />
                  {errTot && <small className={styles.error}>{errTot}</small>}
                </div>
                <div>
                  <label className={styles.label}>Frequency</label>
                  <select value={y.frequency} onChange={e => updateSubsequentYear(idx, 'frequency', e.target.value)} className={`${styles.select} ${errFreq ? 'border-red-500' : ''}`}>
                    <option value="monthly">monthly</option>
                    <option value="quarterly">quarterly</option>
                    <option value="bi-annually">bi-annually</option>
                    <option value="annually">annually</option>
                  </select>
                  {errFreq && <small className={styles.error}>{errFreq}</small>}
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={() => removeSubsequentYear(idx)} className={styles.btn}>Remove</button>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}