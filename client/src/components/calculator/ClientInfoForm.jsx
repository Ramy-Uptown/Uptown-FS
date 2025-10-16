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
        <label style={styles.label}>{t('buyer_name', language)} (<span style={styles.arInline}>[[اسم المشترى]]</span>)</label>
        <input dir="auto" style={input()} value={clientInfo.buyer_name} onChange={e => setClientInfo(s => ({ ...s, buyer_name: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>{t('nationality', language)} (<span style={styles.arInline}>[[الجنسية]]</span>)</label>
        <input dir="auto" style={input()} value={clientInfo.nationality} onChange={e => setClientInfo(s => ({ ...s, nationality: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>{t('id_or_passport', language)} (<span style={styles.arInline}>[[رقم قومي/ رقم جواز]]</span>)</label>
        <input dir="auto" style={input()} value={clientInfo.id_or_passport} onChange={e => setClientInfo(s => ({ ...s, id_or_passport: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>{t('id_issue_date', language)} (<span style={styles.arInline}>[[تاريخ الاصدار]]</span>)</label>
        <input type="date" style={input()} value={clientInfo.id_issue_date} onChange={e => setClientInfo(s => ({ ...s, id_issue_date: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>{t('birth_date', language)} (<span style={styles.arInline}>[[تاريخ الميلاد]]</span>)</label>
        <input type="date" style={input()} value={clientInfo.birth_date || ''} onChange={e => setClientInfo(s => ({ ...s, birth_date: e.target.value }))} />
      </div>
      <div style={styles.blockFull}>
        <label style={styles.label}>{t('address', language)} (<span style={styles.arInline}>[[العنوان]]</span>)</label>
        <textarea dir="auto" style={textarea()} value={clientInfo.address} onChange={e => setClientInfo(s => ({ ...s, address: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>{t('primary_phone', language)} (<span style={styles.arInline}>[[رقم الهاتف]]</span>)</label>
        <input style={input()} value={clientInfo.phone_primary} onChange={e => setClientInfo(s => ({ ...s, phone_primary: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>{t('secondary_phone', language)} (<span style={styles.arInline}>[[رقم الهاتف (2)]]</span>)</label>
        <input style={input()} value={clientInfo.phone_secondary} onChange={e => setClientInfo(s => ({ ...s, phone_secondary: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>{t('email', language)} (<span style={styles.arInline}>[[البريد الالكتروني]]</span>)</label>
        <input type="email" style={input()} value={clientInfo.email} onChange={e => setClientInfo(s => ({ ...s, email: e.target.value }))} />
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