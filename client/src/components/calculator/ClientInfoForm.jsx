import React, { useEffect, useRef, useState } from 'react'
import ClientIdScanner from './ClientIdScanner.jsx'
import { t, isRTL } from '../../lib/i18n.js'

function ClientInfoFormInner({ role, clientInfo, setClientInfo, styles, language = 'en' }) {
  // Local buffered state to avoid external re-renders interrupting typing
  const [local, setLocal] = useState({ ...clientInfo })
  // Track which field is currently being edited to prevent parent sync clobbering keystrokes
  const [focusedKey, setFocusedKey] = useState(null)
  // Track recent edits to add a debounce window where parent sync is ignored
  const [lastEditAt, setLastEditAt] = useState(0)
  // Ref to the form section to check whether the browser focus is inside this form
  const formRef = useRef(null)

  // Sync local buffer when parent clientInfo changes (e.g., OCR apply or snapshot load)
  useEffect(() => {
    const now = Date.now()
    const recentlyEditing = (now - lastEditAt) < 500 // 0.5s debounce after last keystroke
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null
    const isFocusedInForm =
      !!formRef.current &&
      !!activeEl &&
      formRef.current.contains(activeEl) &&
      (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')

    const shouldSkip = !!focusedKey || recentlyEditing || isFocusedInForm

    if (shouldSkip) {
      console.log('[ClientInfoForm] Skip parent->local sync due to focus or recent edit', {
        focusedKey,
        recentlyEditing,
        isFocusedInForm,
        activeTag: activeEl?.tagName,
        activeId: activeEl?.id,
      })
      return
    }

    console.log('[ClientInfoForm] Apply parent->local sync', {
      focusedKey,
      recentlyEditing,
      isFocusedInForm,
      activeTag: activeEl?.tagName,
      activeId: activeEl?.id,
      clientInfo,
    })
    setLocal(prev => {
      return { ...prev, ...clientInfo }
    })
  }, [clientInfo, focusedKey, lastEditAt])

  // Commit a single field to parent state
  const commit = (key) => {
    setClientInfo(s => ({ ...s, [key]: local[key] }))
  }

  // Shared input props
  const input = (err) => styles.input ? styles.input(err) : { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff' }
  const textarea = (err) => styles.textarea ? styles.textarea(err) : { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff', minHeight: 70, resize: 'vertical' }

  const Grid = ({ children }) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>

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
          onChange={e => { setLocal(s => ({ ...s, buyer_name: e.target.value })); setLastEditAt(Date.now()) }}
          onFocus={() => setFocusedKey('buyer_name')}
          onBlur={() => { commit('buyer_name'); setFocusedKey(null) }}
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
          onChange={e => { setLocal(s => ({ ...s, nationality: e.target.value })); setLastEditAt(Date.now()) }}
          onFocus={() => setFocusedKey('nationality')}
          onBlur={() => { commit('nationality'); setFocusedKey(null) }}
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
          onChange={e => { setLocal(s => ({ ...s, id_or_passport: e.target.value })); setLastEditAt(Date.now()) }}
          onFocus={() => setFocusedKey('id_or_passport')}
          onBlur={() => { commit('id_or_passport'); setFocusedKey(null) }}
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
          onChange={e => { setLocal(s => ({ ...s, id_issue_date: e.target.value })); setLastEditAt(Date.now()) }}
          onFocus={() => setFocusedKey('id_issue_date')}
          onBlur={() => { commit('id_issue_date'); setFocusedKey(null) }}
        />
      </div> {/* Corrected closing tag for this div */}
      <div>
        <label htmlFor="birth_date" style={styles.label}>{t('birth_date', language)} (<span style={styles.arInline}>[[تاريخ الميلاد]]</span>)</label>
        <input
          id="birth_date"
          name="birth_date"
          type="date"
          autoComplete="bday"
          style={input()}
          value={local.birth_date || ''}
          onChange={e => { setLocal(s => ({ ...s, birth_date: e.target.value })); setLastEditAt(Date.now()) }}
          onFocus={() => setFocusedKey('birth_date')}
          onBlur={() => { commit('birth_date'); setFocusedKey(null) }}
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
          onChange={e => { setLocal(s => ({ ...s, address: e.target.value })); setLastEditAt(Date.now()) }}
          onFocus={() => setFocusedKey('address')}
          onBlur={() => { commit('address'); setFocusedKey(null) }}
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
          onChange={e => { setLocal(s => ({ ...s, phone_primary: e.target.value })); setLastEditAt(Date.now()) }}
          onFocus={() => setFocusedKey('phone_primary')}
          onBlur={() => { commit('phone_primary'); setFocusedKey(null) }}
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
          onChange={e => { setLocal(s => ({ ...s, phone_secondary: e.target.value })); setLastEditAt(Date.now()) }}
          onFocus={() => setFocusedKey('phone_secondary')}
          onBlur={() => { commit('phone_secondary'); setFocusedKey(null) }}
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
          onChange={e => { setLocal(s => ({ ...s, email: e.target.value })); setLastEditAt(Date.now()) }}
          onFocus={() => setFocusedKey('email')}
          onBlur={() => { commit('email'); setFocusedKey(null) }}
        />
      </div>
    </>
  )

  return (
    <section ref={formRef} style={{ ...styles.section }} dir={isRTL(language) ? 'rtl' : 'ltr'}>
      <h2 style={{ ...styles.sectionTitle, textAlign: isRTL(language) ? 'right' : 'left' }}>{t('client_information', language)}</h2>
      <Grid>{Fields}</Grid>
      {/* Inline scanner (OCR) below client fields */}
      <div style={{ marginTop: 12, padding: 12, border: '1px solid #ead9bd', borderRadius: 10, background: '#fbfaf7' }}>
        <ClientIdScanner styles={styles} />
      </div>
    </section>
  )
}

export default React.memo(ClientInfoFormInner)