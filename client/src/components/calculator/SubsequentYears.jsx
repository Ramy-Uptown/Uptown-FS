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
    <div style={{ ...styles.blockFull, border: '1px solid #eef2f7', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Subsequent Custom Years</h3>
        <button type="button" onClick={addSubsequentYear} style={styles.btn}>+ Add Year</button>
      </div>
      {subsequentYears.length === 0 ? (
        <p style={styles.metaText}>No subsequent custom years defined.</p>
      ) : (
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
          {subsequentYears.map((y, idx) => {
            const errTot = errors[`sub_total_${idx}`]
            const errFreq = errors[`sub_freq_${idx}`]
            return (
              <React.Fragment key={idx}>
                <div>
                  <label style={styles.label}>Total Nominal</label>
                  <input type="number" value={y.totalNominal} onChange={e => updateSubsequentYear(idx, 'totalNominal', e.target.value)} style={styles.input(errTot)} />
                  {errTot && <small style={styles.error}>{errTot}</small>}
                </div>
                <div>
                  <label style={styles.label}>Frequency</label>
                  <select value={y.frequency} onChange={e => updateSubsequentYear(idx, 'frequency', e.target.value)} style={styles.select(errFreq)}>
                    <option value="monthly">monthly</option>
                    <option value="quarterly">quarterly</option>
                    <option value="bi-annually">bi-annually</option>
                    <option value="annually">annually</option>
                  </select>
                  {errFreq && <small style={styles.error}>{errFreq}</small>}
                </div>
                <div style={{ display: 'flex', alignItems: 'end' }}>
                  <button type="button" onClick={() => removeSubsequentYear(idx)} style={styles.btn}>Remove</button>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}