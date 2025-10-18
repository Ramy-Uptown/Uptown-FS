import React, { useEffect, useRef, useState, lazy, Suspense } from 'react'
const ClientIdScanner = lazy(() => import('../ocr/ClientIdScanner.jsx'))
import { t, isRTL } from '../../lib/i18n.js'

function ClientInfoFormInner({ role, clientInfo, setClientInfo, styles, language = 'en' }) {
  // Mode: manual vs OCR-assisted
  const [entryMode, setEntryMode] = useState('manual') // 'manual' | 'ocr'
  const [ocrProcessing, setOcrProcessing] = useState(false)

  // Local buffered state to avoid external re-renders interrupting typing
  const [local, setLocal] = useState({ ...clientInfo })
  // Track which field is currently being edited to prevent parent sync clobbering keystrokes
  const [focusedKey, setFocusedKey] = useState(null)
  // Track recent edits to add a debounce window where parent sync is ignored
  const [lastEditAt, setLastEditAt] = useState(0)
  // Track active typing via onChange with inactivity timeout
  const [typing, setTyping] = useState(false)
  const typingTimerRef = useRef(null)
  // Track focus transitions (short window to guard blur->focus race)
  const [lastFocusChangeAt, setLastFocusChangeAt] = useState(0)
  // Ref to the form section to check whether the browser focus is inside this form
  const formRef = useRef(null)

  // Sync local buffer when parent clientInfo changes (e.g., OCR apply or snapshot load)
  useEffect(() => {
    const now = Date.now()
    const recentlyEditing = (now - lastEditAt) < 1200 // extend debounce to 1.2s to avoid race with external syncs
    const inFocusTransitionWindow = (now - lastFocusChangeAt) < 200 // smaller guard over blur/focus shuffle
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null

    // Robust focus detection using :focus-within and explicit activeElement
    const focusWithin = !!formRef.current && typeof formRef.current.matches === 'function' && formRef.current.matches(':focus-within')

    // Fallback check: is any input/textarea currently focused within the form?
    const anyFocusedEl = (() => {
      if (!formRef.current) return null
      try {
        return formRef.current.querySelector('input:focus, textarea:focus')
      } catch {
        return null
      }
    })()

    const isFocusedInForm =
      !!formRef.current &&
      (focusWithin ||
        (!!activeEl && formRef.current.contains(activeEl) && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) ||
        !!anyFocusedEl)

    const shouldSkip = !!focusedKey || recentlyEditing || typing || isFocusedInForm || inFocusTransitionWindow

    if (shouldSkip) {
      console.log('[ClientInfoForm] Skip parent->local sync due to focus or recent edit', {
        focusedKey,
        recentlyEditing,
        typing,
        isFocusedInForm,
        focusWithin,
        inFocusTransitionWindow,
        activeTag: activeEl?.tagName,
        activeId: activeEl?.id,
        anyFocusedTag: anyFocusedEl?.tagName,
        anyFocusedId: anyFocusedEl?.id,
      })
      return
    }

    // Selective merge: do not overwrite the actively focused field
    setLocal(prev => {
      const merged = { ...prev }
      let appliedCount = 0
      for (const k of Object.keys(clientInfo || {})) {
        if (focusedKey && k === focusedKey) continue
        if (merged[k] !== clientInfo[k]) {
          merged[k] = clientInfo[k]
          appliedCount++
        }
      }
      console.log('[ClientInfoForm] Apply parent->local selective merge', {
        focusedKey,
        appliedCount,
        keysApplied: appliedCount > 0 ? Object.keys(clientInfo || {}).filter(k => (!focusedKey || k !== focusedKey) && prev[k] !== clientInfo[k]) : [],
      })
      return merged
    })
  }, [clientInfo, focusedKey, lastEditAt, typing, lastFocusChangeAt])

  // Commit a single field to parent state
  const commit = (key) => {
    setClientInfo(s => ({ ...s, [key]: local[key] }))
  }

  // Shared input props
  const baseInputStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff' }
  const input = (err) => styles.input ? styles.input(err) : baseInputStyle
  const textarea = (err) => styles.textarea ? styles.textarea(err) : { ...baseInputStyle, minHeight: 70, resize: 'vertical' }

  // Helper to mark typing activity and debounce its reset
  const markTyping = () => {
    setLastEditAt(Date.now())
    setTyping(true)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      setTyping(false)
      typingTimerRef.current = null
    }, 1000)
  }

  const Grid = ({ children }) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>

  // Disable fields during OCR processing (except phones and email which remain manual)
  const disableForOCR = (key) => {
    if (!ocrProcessing || entryMode !== 'ocr') return false
    // Disable only OCR-populated fields
    return ['buyer_name', 'nationality', 'id_or_passport', 'id_issue_date', 'birth_date', 'address'].includes(key)
  }

  // OCR callbacks
  const handleOCRStart = () => {
    console.log('[ClientInfoForm] OCR started')
    setOcrProcessing(true)
  }
  const handleOCRApply = (updates) => {
    console.log('[ClientInfoForm] OCR complete — applying updates', { updates })
    // Exclude phones and email explicitly
    const sanitized = {
      buyer_name: updates.buyer_name ?? '',
      nationality: updates.nationality ?? '',
      id_or_passport: updates.id_or_passport ?? '',
      id_issue_date: updates.id_issue_date ?? '',
      birth_date: updates.birth_date ?? '',
      address: updates.address ?? ''
    }
    setClientInfo(s => ({ ...s, ...sanitized }))
    setLocal(s => ({ ...s, ...sanitized }))
    setOcrProcessing(false)
  }
  const handleOCRError = (msg) => {
    console.log('[ClientInfoForm] OCR error', msg)
    setOcrProcessing(false)
  }

  const ModeToggle = (
    <div style={{ marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#5b4630' }}>Entry Mode:</label>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="radio"
          name="entry_mode"
          checked={entryMode === 'manual'}
          onChange={() => setEntryMode('manual')}
        />
        Manual
      </label>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="radio"
          name="entry_mode"
          checked={entryMode === 'ocr'}
          onChange={() => setEntryMode('ocr')}
        />
        OCR-assisted
      </label>
      {entryMode === 'ocr' && (
        <small style={{ color: '#6b7280' }}>
          Phones and email remain manual. Other fields may be auto-filled after scanning.
        </small>
      )}
    </div>
  )

  const Fields = (
    <>
      <div>
        <label htmlFor="buyer_name" style={styles.label}>{t('buyer_name', language)} (<span style={styles.arInline}>[[اسم المشترى]]</span>)</label>
        <input
          id="buyer_name"
          name="buyer_name"
          dir="auto"
          autoComplete="name"
          style={input()}
          value={local.buyer_name || ''}
          disabled={disableForOCR('buyer_name')}
          onChange={e => { setLocal(s => ({ ...s, buyer_name: e.target.value })); markTyping() }}
          onFocus={() => { setFocusedKey('buyer_name'); setLastFocusChangeAt(Date.now()) }}
          onBlur={() => { commit('buyer_name'); setFocusedKey(null); setLastFocusChangeAt(Date.now()) }}
        />
      </div>
      <div>
        <label htmlFor="nationality" style={styles.label}>{t('nationality', language)} (<span style={styles.arInline}>[[الجنسية]]</span>)</label>
        <input
          id="nationality"
          name="nationality"
          dir="auto"
          autoComplete="country-name"
          style={input()}
          value={local.nationality || ''}
          disabled={disableForOCR('nationality')}
          onChange={e => { setLocal(s => ({ ...s, nationality: e.target.value })); markTyping() }}
          onFocus={() => { setFocusedKey('nationality'); setLastFocusChangeAt(Date.now()) }}
          onBlur={() => { commit('nationality'); setFocusedKey(null); setLastFocusChangeAt(Date.now()) }}
        />
      </div>
      <div>
        <label htmlFor="id_or_passport" style={styles.label}>{t('id_or_passport', language)} (<span style={styles.arInline}>[[رقم قومي/ رقم جواز]]</span>)</label>
        <input
          id="id_or_passport"
          name="id_or_passport"
          dir="auto"
          autoComplete="off"
          style={input()}
          value={local.id_or_passport || ''}
          disabled={disableForOCR('id_or_passport')}
          onChange={e => { setLocal(s => ({ ...s, id_or_passport: e.target.value })); markTyping() }}
          onFocus={() => { setFocusedKey('id_or_passport'); setLastFocusChangeAt(Date.now()) }}
          onBlur={() => { commit('id_or_passport'); setFocusedKey(null); setLastFocusChangeAt(Date.now()) }}
        />
      </div>
      <div>
        <label htmlFor="id_issue_date" style={styles.label}>{t('id_issue_date', language)} (<span style={styles.arInline}>[[تاريخ الاصدار]]</span>)</label>
        <input
          id="id_issue_date"
          name="id_issue_date"
          type="date"
          style={input()}
          value={local.id_issue_date || ''}
          disabled={disableForOCR('id_issue_date')}
          onChange={e => { setLocal(s => ({ ...s, id_issue_date: e.target.value })); markTyping() }}
          onFocus={() => { setFocusedKey('id_issue_date'); setLastFocusChangeAt(Date.now()) }}
          onBlur={() => { commit('id_issue_date'); setFocusedKey(null); setLastFocusChangeAt(Date.now()) }}
        />
      </div>
      <div>
        <label htmlFor="birth_date" style={styles.label}>{t('birth_date', language)} (<span style={styles.arInline}>[[تاريخ الميلاد]]</span>)</label>
        <input
          id="birth_date"
          name="birth_date"
          type="date"
          autoComplete="bday"
          style={input()}
          value={local.birth_date || ''}
          disabled={disableForOCR('birth_date')}
          onChange={e => { setLocal(s => ({ ...s, birth_date: e.target.value })); markTyping() }}
          onFocus={() => { setFocusedKey('birth_date'); setLastFocusChangeAt(Date.now()) }}
          onBlur={() => { commit('birth_date'); setFocusedKey(null); setLastFocusChangeAt(Date.now()) }}
        />
      </div>
      <div style={styles.blockFull}>
        <label htmlFor="address" style={styles.label}>{t('address', language)} (<span style={styles.arInline}>[[العنوان]]</span>)</label>
        <textarea
          id="address"
          name="address"
          dir="auto"
          autoComplete="street-address"
          style={textarea()}
          value={local.address || ''}
          disabled={disableForOCR('address')}
          onChange={e => { setLocal(s => ({ ...s, address: e.target.value })); markTyping() }}
          onFocus={() => { setFocusedKey('address'); setLastFocusChangeAt(Date.now()) }}
          onBlur={() => { commit('address'); setFocusedKey(null); setLastFocusChangeAt(Date.now()) }}
        />
      </div>
      <div>
        <label htmlFor="phone_primary" style={styles.label}>{t('primary_phone', language)} (<span style={styles.arInline}>[[رقم الهاتف]]</span>)</label>
        <input
          id="phone_primary"
          name="phone_primary"
          type="tel"
          autoComplete="tel"
          style={input()}
          value={local.phone_primary || ''}
          onChange={e => { setLocal(s => ({ ...s, phone_primary: e.target.value })); markTyping() }}
          onFocus={() => { setFocusedKey('phone_primary'); setLastFocusChangeAt(Date.now()) }}
          onBlur={() => { commit('phone_primary'); setFocusedKey(null); setLastFocusChangeAt(Date.now()) }}
        />
      </div>
      <div>
        <label htmlFor="phone_secondary" style={styles.label}>{t('secondary_phone', language)} (<span style={styles.arInline}>[[رقم الهاتف (2)]]</span>)</label>
        <input
          id="phone_secondary"
          name="phone_secondary"
          type="tel"
          autoComplete="tel-national"
          style={input()}
          value={local.phone_secondary || ''}
          onChange={e => { setLocal(s => ({ ...s, phone_secondary: e.target.value })); markTyping() }}
          onFocus={() => { setFocusedKey('phone_secondary'); setLastFocusChangeAt(Date.now()) }}
          onBlur={() => { commit('phone_secondary'); setFocusedKey(null); setLastFocusChangeAt(Date.now()) }}
        />
      </div>
      <div>
        <label htmlFor="email" style={styles.label}>{t('email', language)} (<span style={styles.arInline}>[[البريد الالكتروني]]</span>)</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          style={input()}
          value={local.email || ''}
          onChange={e => { setLocal(s => ({ ...s, email: e.target.value })); markTyping() }}
          onFocus={() => { setFocusedKey('email'); setLastFocusChangeAt(Date.now()) }}
          onBlur={() => { commit('email'); setFocusedKey(null); setLastFocusChangeAt(Date.now()) }}
        />
      </div>
    </>
  )

  return (
    <section
      ref={formRef}
      onFocusCapture={() => setLastFocusChangeAt(Date.now())}
      style={{ ...styles.section }}
      dir={isRTL(language) ? 'rtl' : 'ltr'}
    >
      <h2 style={{ ...styles.sectionTitle, textAlign: isRTL(language) ? 'right' : 'left' }}>{t('client_information', language)}</h2>
      {ModeToggle}
      <Grid>{Fields}</Grid>
      {/* OCR module (lazy mount only when OCR mode) */}
      {entryMode === 'ocr' && (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #ead9bd', borderRadius: 10, background: '#fbfbf7' }}>
          <Suspense fallback={<small style={{ color: '#6b7280' }}>Loading OCR module…</small>}>
            <ClientIdScanner
              styles={styles}
              onStart={handleOCRStart}
              onApply={handleOCRApply}
              onError={handleOCRError}
            />
          </Suspense>
        </div>
      )}
    </section>
  )
}

export default React.memo(ClientInfoFormInner)