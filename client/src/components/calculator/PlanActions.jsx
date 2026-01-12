import React from 'react'

export default function PlanActions({ styles, genLoading, onGenerate }) {
  return (
    <div className={`${styles.blockFull} flex gap-3`}>
      <button type="submit" disabled={genLoading} className={`${styles.btnPrimary} ${genLoading ? 'opacity-70' : ''}`} onClick={onGenerate}>
        {genLoading ? 'Calculating...' : 'Calculate (Generate Plan)'}
      </button>
    </div>
  )
}