import React from 'react'

export default function ClientInfoForm({ role, clientInfo, setClientInfo, styles }) {
  // Shared input props
  const input = (err) => styles.input ? styles.input(err) : { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff' }
  const textarea = (err) => styles.textarea ? styles.textarea(err) : { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff', minHeight: 70, resize: 'vertical' }

  const Grid = ({ children }) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>

  const BasicFields = (
    <>
      <div>
        <label style={styles.label}>Buyer Name (<span style={styles.arInline}>[[اسم المشترى]]</span>)</label>
        <input dir="auto" style={input()} value={clientInfo.buyer_name} onChange={e => setClientInfo(s => ({ ...s, buyer_name: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>Primary Phone No. (<span style={styles.arInline}>[[رقم الهاتف]]</span>)</label>
        <input style={input()} value={clientInfo.phone_primary} onChange={e => setClientInfo(s => ({ ...s, phone_primary: e.target.value }))} />
      </div>
    </>
  )

  const ExtendedFields = (
    <>
      <div>
        <label style={styles.label}>Buyer Name (<span style={styles.arInline}>[[اسم المشترى]]</span>)</label>
        <input dir="auto" style={input()} value={clientInfo.buyer_name} onChange={e => setClientInfo(s => ({ ...s, buyer_name: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>Nationality (<span style={styles.arInline}>[[الجنسية]]</span>)</label>
        <input dir="auto" style={input()} value={clientInfo.nationality} onChange={e => setClientInfo(s => ({ ...s, nationality: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>National ID / Passport No. (<span style={styles.arInline}>[[رقم قومي/ رقم جواز]]</span>)</label>
        <input dir="auto" style={input()} value={clientInfo.id_or_passport} onChange={e => setClientInfo(s => ({ ...s, id_or_passport: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>ID/Passport Issue Date (<span style={styles.arInline}>[[تاريخ الاصدار]]</span>)</label>
        <input type="date" style={input()} value={clientInfo.id_issue_date} onChange={e => setClientInfo(s => ({ ...s, id_issue_date: e.target.value }))} />
      </div>
      <div style={styles.blockFull}>
        <label style={styles.label}>Address (<span style={styles.arInline}>[[العنوان]]</span>)</label>
        <textarea dir="auto" style={textarea()} value={clientInfo.address} onChange={e => setClientInfo(s => ({ ...s, address: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>Primary Phone No. (<span style={styles.arInline}>[[رقم الهاتف]]</span>)</label>
        <input style={input()} value={clientInfo.phone_primary} onChange={e => setClientInfo(s => ({ ...s, phone_primary: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>Secondary Phone No. (<span style={styles.arInline}>[[رقم الهاتف (2)]]</span>)</label>
        <input style={input()} value={clientInfo.phone_secondary} onChange={e => setClientInfo(s => ({ ...s, phone_secondary: e.target.value }))} />
      </div>
      <div>
        <label style={styles.label}>Email Address (<span style={styles.arInline}>[[البريد الالكتروني]]</span>)</label>
        <input type="email" style={input()} value={clientInfo.email} onChange={e => setClientInfo(s => ({ ...s, email: e.target.value }))} />
      </div>
    </>
  )

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Client Information</h2>
      {role === 'property_consultant' ? (
        <Grid>{BasicFields}</Grid>
      ) : (
        <Grid>{ExtendedFields}</Grid>
      )}
    </section>
  )
}