import React from 'react'
import ClientIdScanner from './ClientIdScanner.jsx'
import { t, isRTL } from '../../lib/i18n.js'

function ClientInfoFormInner({ role, clientInfo, setClientInfo, styles, language = 'en' }) {
  // Shared input props
  const input = (err) => styles.input ? styles.input(err) : { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff' }
  const textarea = (err) => styles.textarea ? styles.textarea(err) : { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff', minHeight: 70, resize: 'vertical' }

  const Grid = ({ children }) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>

  const Fields = (
    <>
      <div>
        <label htmlFor="buyer_name" style={styles.label}>{t('buyer_name', language)} (<span style={styles.arInline}>[[اسم المشترى]]</span>)</label>
        <input id="buyer_name" name="buyer_name" dir="auto" style={input()} value={clientInfo.buyer_name} onChange={e => setClientInfo(s => ({ ...s, buyer_name: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="nationality" style={styles.label}>{t('nationality', language)} (<span style={styles.arInline}>[[الجنسية]]</span>)</label>
        <input id="nationality" name="nationality" dir="auto" style={input()} value={clientInfo.nationality} onChange={e => setClientInfo(s => ({ ...s, nationality: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="id_or_passport" style={styles.label}>{t('id_or_passport', language)} (<span style={styles.arInline}>[[رقم قومي/ رقم جواز]]</span>)</label>
        <input id="id_or_passport" name="id_or_passport" dir="auto" style={input()} value={clientInfo.id_or_passport} onChange={e => setClientInfo(s => ({ ...s, id_or_passport: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="id_issue_date" style={styles.label}>{t('id_issue_date', language)} (<span style={styles.arInline}>[[تاريخ الاصدار]]</span>)</label>
        <input id="id_issue_date" name="id_issue_date" type="date" style={input()} value={clientInfo.id_issue_date} onChange={e => setClientInfo(s => ({ ...s, id_issue_date: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="birth_date" style={styles.label}>{t('birth_date', language)} (<span style={styles.arInline}>[[تاريخ الميلاد]]</span>)</label>
        <input id="birth_date" name="birth_date" type="date" style={input()} value={clientInfo.birth_date || ''} onChange={e => setClientInfo(s => ({ ...s, birth_date: e.target.value }))} />
      </div>
      <div style={styles.blockFull}>
        <label htmlFor="address" style={styles.label}>{t('address', language)} (<span style={styles.arInline}>[[العنوان]]</span>)</label>
        <textarea id="address" name="address" dir="auto" style={textarea()} value={clientInfo.address} onChange={e => setClientInfo(s => ({ ...s, address: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="phone_primary" style={styles.label}>{t('primary_phone', language)} (<span style={styles.arInline}>[[رقم الهاتف]]</span>)</label>
        <input id="phone_primary" name="phone_primary" style={input()} value={clientInfo.phone_primary} onChange={e => setClientInfo(s => ({ ...s, phone_primary: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="phone_secondary" style={styles.label}>{t('secondary_phone', language)} (<span style={styles.arInline}>[[رقم الهاتف (2)]]</span>)</label>
        <input id="phone_secondary" name="phone_secondary" style={input()} value={clientInfo.phone_secondary} onChange={e => setClientInfo(s => ({ ...s, phone_secondary: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="email" style={styles.label}>{t('email', language)} (<span style={styles.arInline}>[[البريد الالكتروني]]</span>)</label>
        <input id="email" name="email" type="email" style={input()} value={clientInfo.email} onChange={e => setClientInfo(s => ({ ...s, email: e.target.value }))} />
      </div>
    </>
  )

  return (
    <section style={{ ...styles.section }} dir={isRTL(language) ? 'rtl' : 'ltr'}>
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