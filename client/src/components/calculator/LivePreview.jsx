import React from 'react'

export default function LivePreview({ styles, previewError, summaries, language }) {
  return (
    <div style={{ ...styles.blockFull, border: '1px solid #eef2f7', borderRadius: 10, padding: 12 }}>
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600 }}>Live Preview (Calculation)</h3>
      {previewError ? <p style={styles.error}>{previewError}</p> : null}
      {summaries ? (
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>Total Nominal Price: {Number(summaries.totalNominalPrice || 0).toLocaleString()}</li>
          <li>Equal Installments: {summaries.numEqualInstallments}</li>
          <li>Installment Amount: {Number(summaries.equalInstallmentAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
          <li>Calculated PV: {Number(summaries.calculatedPV || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
          <li>Effective Start Years (for installments): {summaries.effectiveStartYears}</li>
        </ul>
      ) : (
        !previewError && <p style={styles.metaText}>Adjust form inputs to see live preview.</p>
      )}
    </div>
  )
}