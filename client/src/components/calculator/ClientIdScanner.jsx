import React, { useState } from 'react'
import { fetchWithAuth, API_URL } from '../../lib/apiClient.js'

export default function ClientIdScanner({ styles }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const input = styles?.input ? styles.input(false) : { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff' }
  const btn = styles?.btnPrimary || { padding: '10px 14px', borderRadius: 10, border: '1px solid #A97E34', background: '#A97E34', color: '#fff', cursor: 'pointer', fontWeight: 600 }

  async function run() {
    try {
      setError('')
      setResult(null)
      if (!file) {
        setError('Please choose an ID image first.')
        return
      }
      setLoading(true)
      const form = new FormData()
      form.append('image', file)
      const resp = await fetchWithAuth(`${API_URL}/api/ocr/egypt-id`, { method: 'POST', body: form })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || 'OCR failed')
      setResult(data)
      const fields = data?.fields || {}
      const apply = window.__uptown_calc_applyClientInfo
      if (typeof apply === 'function') {
        const updates = {
          buyer_name: String(fields.name || ''),
          id_or_passport: String(fields.nationalId || ''),
          address: String(fields.address || '')
        }
        // If national ID looks numeric -> set nationality and birth date if available
        if (updates.id_or_passport && !/\D/.test(updates.id_or_passport)) {
          updates.nationality = 'Egyptian'
          if (fields.birthDate) updates.birth_date = fields.birthDate // expect YYYY-MM-DD when available
        }
        apply(updates)
      }
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Scan Egyptian National ID</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} style={{ ...input, padding: 0, border: 'none', background: 'transparent' }} />
        <button onClick={run} disabled={loading} style={btn}>{loading ? 'Processing…' : 'Extract from ID'}</button>
        {result?.engine ? (
          <small style={{ color: '#6b7280' }}>
            Engine: {result.engine === 'google_vision' ? 'Google Vision (cloud)' : 'Tesseract (local)'}
          </small>
        ) : null}
      </div>
      {error ? <p style={{ color: '#e11d48' }}>{error}</p> : null}
    </div>
  )
}