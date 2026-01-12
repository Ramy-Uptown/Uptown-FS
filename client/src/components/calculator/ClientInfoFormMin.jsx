import React from 'react'
import { t, isRTL } from '../../lib/i18n.js'

/**
 * Minimal, no-OCR client info form.
 * Plain controlled inputs only; no local buffering or OCR.
 * Restores all fields from the original form with same labels and autocomplete hints.
 * Adds support for multiple buyers (1..4). For buyers 2..N, fields are suffixed with _2, _3, _4 respectively.
 */
export default function ClientInfoFormMinimal({ role, clientInfo, setClientInfo, styles, language = 'en', unitBlocked = false }) {


  const set = (k) => (e) => {
    const v = e.target.value
    setClientInfo(s => ({ ...s, [k]: v }))
  }

  const numberOfBuyers = Math.min(Math.max(Number(clientInfo.number_of_buyers || 1), 1), 4)

  const renderBuyerFields = (index) => {
    const suffix = index === 1 ? '' : `_${index}`
    return (
      <div key={index} className={`grid grid-cols-2 gap-2 ${index === 1 ? '' : 'mt-4'}`}>
        {index > 1 && (
          <div className="col-span-2 mb-1">
            <strong className="text-primary-dark">{isRTL(language) ? `بيانات المشترى رقم ${index}` : `Buyer ${index} Information`}</strong>
          </div>
        )}
        <div>
          <label htmlFor={`buyer_name${suffix}`} className={styles.label}>{t('buyer_name', language)} (<span className={styles.arInline}>[[اسم المشترى]]</span>)</label>
          <input
            id={`buyer_name${suffix}`}
            name={`buyer_name${suffix}`}
            dir="auto"
            autoComplete="name"
            className={styles.input}
            value={clientInfo[`buyer_name${suffix}`] || ''}
            onChange={set(`buyer_name${suffix}`)}
            disabled={role === 'property_consultant' && unitBlocked}
            title={role === 'property_consultant' && unitBlocked ? 'Locked after unit is blocked (consultant cannot change client name)' : undefined}
          />
        </div>
        <div>
          <label htmlFor={`nationality${suffix}`} className={styles.label}>{t('nationality', language)} (<span className={styles.arInline}>[[الجنسية]]</span>)</label>
          <input
            id={`nationality${suffix}`}
            name={`nationality${suffix}`}
            dir="auto"
            autoComplete="country-name"
            className={styles.input}
            value={clientInfo[`nationality${suffix}`] || ''}
            onChange={set(`nationality${suffix}`)}
          />
        </div>
        <div>
          <label htmlFor={`id_or_passport${suffix}`} className={styles.label}>{t('id_or_passport', language)} (<span className={styles.arInline}>[[رقم قومي/ رقم جواز]]</span>)</label>
          <input
            id={`id_or_passport${suffix}`}
            name={`id_or_passport${suffix}`}
            dir="auto"
            autoComplete="off"
            className={styles.input}
            value={clientInfo[`id_or_passport${suffix}`] || ''}
            onChange={set(`id_or_passport${suffix}`)}
          />
        </div>
        <div>
          <label htmlFor={`id_issue_date${suffix}`} className={styles.label}>{t('id_issue_date', language)} (<span className={styles.arInline}>[[تاريخ الاصدار]]</span>)</label>
          <input
            id={`id_issue_date${suffix}`}
            name={`id_issue_date${suffix}`}
            type="date"
            className={styles.input}
            value={clientInfo[`id_issue_date${suffix}`] || ''}
            onChange={set(`id_issue_date${suffix}`)}
          />
        </div>
        <div>
          <label htmlFor={`birth_date${suffix}`} className={styles.label}>{t('birth_date', language)} (<span className={styles.arInline}>[[تاريخ الميلاد]]</span>)</label>
          <input
            id={`birth_date${suffix}`}
            name={`birth_date${suffix}`}
            type="date"
            autoComplete="bday"
            className={styles.input}
            value={clientInfo[`birth_date${suffix}`] || ''}
            onChange={set(`birth_date${suffix}`)}
          />
        </div>
        <div className={styles.blockFull}>
          <label htmlFor={`address${suffix}`} className={styles.label}>{t('address', language)} (<span className={styles.arInline}>[[العنوان]]</span>)</label>
          <textarea
            id={`address${suffix}`}
            name={`address${suffix}`}
            dir="auto"
            autoComplete="street-address"
            className={styles.textarea}
            value={clientInfo[`address${suffix}`] || ''}
            onChange={set(`address${suffix}`)}
          />
        </div>
        <div>
          <label htmlFor={`phone_primary${suffix}`} className={styles.label}>{t('primary_phone', language)} (<span className={styles.arInline}>[[رقم الهاتف]]</span>)</label>
          <input
            id={`phone_primary${suffix}`}
            name={`phone_primary${suffix}`}
            type="tel"
            autoComplete="tel"
            className={styles.input}
            value={clientInfo[`phone_primary${suffix}`] || ''}
            onChange={set(`phone_primary${suffix}`)}
            disabled={role === 'property_consultant' && unitBlocked}
            title={role === 'property_consultant' && unitBlocked ? 'Locked after unit is blocked (consultant cannot change client phone)' : undefined}
          />
        </div>
        <div>
          <label htmlFor={`phone_secondary${suffix}`} className={styles.label}>{t('secondary_phone', language)} (<span className={styles.arInline}>[[رقم الهاتف (2)]]</span>)</label>
          <input
            id={`phone_secondary${suffix}`}
            name={`phone_secondary${suffix}`}
            type="tel"
            autoComplete="tel-national"
            className={styles.input}
            value={clientInfo[`phone_secondary${suffix}`] || ''}
            onChange={set(`phone_secondary${suffix}`)}
          />
        </div>
        <div>
          <label htmlFor={`email${suffix}`} className={styles.label}>{t('email', language)} (<span className={styles.arInline}>[[البريد الالكتروني]]</span>)</label>
          <input
            id={`email${suffix}`}
            name={`email${suffix}`}
            type="email"
            autoComplete="email"
            className={styles.input}
            value={clientInfo[`email${suffix}`] || ''}
            onChange={set(`email${suffix}`)}
            disabled={role === 'property_consultant' && unitBlocked}
            title={role === 'property_consultant' && unitBlocked ? 'Locked after unit is blocked (consultant cannot change client email)' : undefined}
          />
        </div>
      </div>
    )
  }

  return (
    <section className={styles.section} dir={isRTL(language) ? 'rtl' : 'ltr'}>
      <h2 className={`${styles.sectionTitle} ${isRTL(language) ? 'text-right' : 'text-left'}`}>{t('client_information', language)}</h2>

      {/* Number of Buyers selector (1..4) */}
      <div className="mb-3 inline-flex items-center gap-2">
        <label htmlFor="number_of_buyers" className={styles.label}>{isRTL(language) ? 'عدد المشترين' : 'Number of Buyers'}</label>
        <select
          id="number_of_buyers"
          name="number_of_buyers"
          value={numberOfBuyers}
          onChange={e => {
            const v = Math.min(Math.max(Number(e.target.value || 1), 1), 4)
            setClientInfo(s => ({ ...s, number_of_buyers: v }))
          }}
          className={`${styles.select} w-[60px]`}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </div>

      {/* Buyer 1 fields (original) */}
      {renderBuyerFields(1)}

      {/* Additional buyers */}
      {numberOfBuyers >= 2 && renderBuyerFields(2)}
      {numberOfBuyers >= 3 && renderBuyerFields(3)}
      {numberOfBuyers >= 4 && renderBuyerFields(4)}
    </section>
  )
}