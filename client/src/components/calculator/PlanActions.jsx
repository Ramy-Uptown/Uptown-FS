import React from 'react'

export default function PlanActions({ styles, genLoading, onGenerate }) {
  return (
    <div style={{ ...styles.blockFull, display: 'flex', gap: 10 }}>
      <button type="submit" disabled={genLoading} style={{ ...styles.btnPrimary, opacity: genLoading ? 0.7 : 1 }} onClick={onGenerate}>
        {genLoading ? 'Calculating...' : 'Calculate (Generate Plan)'}
      </button>
    </div>
  )
}