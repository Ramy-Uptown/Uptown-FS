import React, { useEffect } from 'react'
import LivePreview from './LivePreview.jsx'
import PlanActions from './PlanActions.jsx'
import FirstYearPayments from './FirstYearPayments.jsx'
import SubsequentYears from './SubsequentYears.jsx'
import { t, isRTL, applyDocumentDirection } from '../../lib/i18n.js'

export default function InputsForm({
  styles,
  language, setLanguage,
  currency, setCurrency,
  mode, setMode,
  stdPlan, setStdPlan,
  inputs, setInputs,
  errors,
  unitPricingBreakdown,
  rateLocked,
  DiscountHint,
  summaries,
  previewError,
  genLoading,
  onGeneratePlan,
  // arrays and handlers
  firstYearPayments,
  addFirstYearPayment,
  updateFirstYearPayment,
  removeFirstYearPayment,
  subsequentYears,
  addSubsequentYear,
  updateSubsequentYear,
  removeSubsequentYear,
  // preview effect helpers
  validateForm,
  buildPayload,
  setPreview,
  setPreviewError,
  role
}) {
  const input = (err) => styles.input ? styles.input(err) : { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff' }
  const select = (err) => styles.select ? styles.select(err) : { padding: '10px 12px', borderRadius: 10, border: '1px solid #dfe5ee', outline: 'none', width: '100%', fontSize: 14, background: '#fbfdff' }
  const todayStr = new Date().toISOString().slice(0, 10)

  // Apply document direction whenever language changes
  useEffect(() => {
    applyDocumentDirection(language)
  }, [language])

  return (
    <section style={{ ...styles.section }} dir={isRTL(language) ? 'rtl' : 'ltr'}>
      <h2 style={{ ...styles.sectionTitle, textAlign: isRTL(language) ? 'right' : 'left' }}>{t('inputs', language)}</h2>
      <form onSubmit={(e) => { e.preventDefault(); onGeneratePlan(e) }} style={{ ...styles.grid2 }}>
        <div>
          <label style={styles.label}>{t('language_for_written_amounts', language)}</label>
          <select value={language} onChange={e => setLanguage(e.target.value)} style={select()}>
            <option value="en">{t('english', language)}</option>
            <option value="ar">{t('arabic', language)}</option>
          </select>
        </div>

        <div>
          <label style={styles.label}>{t('currency', language)}</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} style={select()}>
            <option value="EGP">EGP (Egyptian Pounds)</option>
            <option value="USD">USD (US Dollars)</option>
            <option value="SAR">SAR (Saudi Riyals)</option>
            <option value="EUR">EUR (Euros)</option>
            <option value="AED">AED (UAE Dirhams)</option>
            <option value="KWD">Kuwaiti Dinars</option>
          </select>
        </div>

        <div>
          <label style={styles.label}>{t('offer_date', language)}<span style={{ color: '#ef4444' }}> *</span></label>
          <input
            type="date"
            value={inputs.offerDate || todayStr}
            onChange={e => setInputs(s => ({ ...s, offerDate: e.target.value, firstPaymentDate: s.firstPaymentDate || e.target.value }))}
            style={input(errors.offerDate)}
            required
          />
          {errors.offerDate && <small style={styles.error}>{errors.offerDate}</small>}
        </div>

        <div>
          <label style={styles.label}>{t('first_payment_date', language)}<span style={{ color: '#ef4444' }}> *</span></label>
          <input
            type="date"
            value={inputs.firstPaymentDate || inputs.offerDate || todayStr}
            onChange={e => setInputs(s => ({ ...s, firstPaymentDate: e.target.value }))}
            style={input(errors.firstPaymentDate)}
            required
          />
          {errors.firstPaymentDate && <small style={styles.error}>{errors.firstPaymentDate}</small>}
        </div>

        <div>
          <label style={styles.label}>{t('mode', language)}</label>
          <select value={mode} onChange={e => setMode(e.target.value)} style={select()}>
            <option value="evaluateCustomPrice">evaluateCustomPrice</option>
            <option value="calculateForTargetPV">calculateForTargetPV</option>
            <option value="customYearlyThenEqual_useStdPrice">customYearlyThenEqual_useStdPrice</option>
            <option value="customYearlyThenEqual_targetPV">customYearlyThenEqual_targetPV</option>
          </select>
        </div>

        <div>
          <label style={styles.label}>{t('installment_frequency', language)}</label>
          <select value={inputs.installmentFrequency} onChange={e => setInputs(s => ({ ...s, installmentFrequency: e.target.value }))} style={select(errors.installmentFrequency)}>
            <option value="monthly">{t('monthly', language)}</option>
            <option value="quarterly">{t('quarterly', language)}</option>
            <option value="bi-annually">{t('bi_annually', language)}</option>
            <option value="annually">{t('annually', language)}</option>
          </select>
          {errors.installmentFrequency && <small style={styles.error}>{errors.installmentFrequency}</small>}
        </div>

        <div>
          <label style={styles.label}>{t('std_total_price', language)}</label>
          <input
            type="number"
            value={stdPlan.totalPrice}
            onChange={e => setStdPlan(s => ({ ...s, totalPrice: e.target.value }))}
            style={input(errors.std_totalPrice)}
            disabled={rateLocked}
            title={rateLocked ? 'Locked to server-approved standard for selected unit' : undefined}
          />
          {errors.std_totalPrice && <small style={styles.error}>{errors.std_totalPrice}</small>}
          <div style={{ marginTop: 6, fontSize: 12, color: '#4b5563', background: '#fbfaf7', border: '1px dashed #ead9bd', borderRadius: 8, padding: 8 }}>
            <div><strong>{t('unit_breakdown', language)}</strong></div>
            <div>{t('base', language)}: {Number(unitPricingBreakdown.base || 0).toLocaleString()}</div>
            <div>{t('garden', language)}: {Number(unitPricingBreakdown.garden || 0).toLocaleString()}</div>
            <div>{t('roof', language)}: {Number(unitPricingBreakdown.roof || 0).toLocaleString()}</div>
            <div>{t('storage', language)}: {Number(unitPricingBreakdown.storage || 0).toLocaleString()}</div>
            <div>{t('garage', language)}: {Number(unitPricingBreakdown.garage || 0).toLocaleString()}</div>
            <div style={{ marginTop: 4 }}><strong>{t('total_excl_maint', language)}: {Number(unitPricingBreakdown.totalExclMaintenance || 0).toLocaleString()}</strong></div>
            <div>{t('maintenance', language)}: {Number(unitPricingBreakdown.maintenance || 0).toLocaleString()}</div>
          </div>
        </div>
        {role !== 'property_consultant' && (
          <div>
            <label style={styles.label}>{t('std_financial_rate', language)}</label>
            <input
              type="number"
              value={stdPlan.financialDiscountRate}
              onChange={e => setStdPlan(s => ({ ...s, financialDiscountRate: e.target.value }))}
              style={input(errors.std_financialDiscountRate)}
              disabled={rateLocked}
              title={rateLocked ? 'Locked to server-approved standard for selected unit' : undefined}
            />
            {errors.std_financialDiscountRate && <small style={styles.error}>{errors.std_financialDiscountRate}</small>}
          </div>
        )}
        <div>
          <label style={styles.label}>{t('std_calculated_pv', language)}</label>
          <input
            type="number"
            value={stdPlan.calculatedPV}
            onChange={e => setStdPlan(s => ({ ...s, calculatedPV: e.target.value }))}
            style={input(errors.std_calculatedPV)}
            disabled={rateLocked}
            title={rateLocked ? 'Locked to server-approved standard for selected unit' : undefined}
          />
          {errors.std_calculatedPV && <small style={styles.error}>{errors.std_calculatedPV}</small>}
        </div>

        <div>
          <label style={styles.label}>{t('sales_discount', language)}</label>
          <input type="number" value={inputs.salesDiscountPercent} onChange={e => setInputs(s => ({ ...s, salesDiscountPercent: e.target.value }))} style={input()} />
          {DiscountHint && <DiscountHint role={undefined} value={inputs.salesDiscountPercent} />}
        </div>

        {(() => {
          const pvTargetMode = mode === 'calculateForTargetPV' || mode === 'customYearlyThenEqual_targetPV'
          return (
            <>
              <div>
                <label style={styles.label}>{t('dp_type', language)}</label>
                <select
                  value={pvTargetMode ? 'amount' : inputs.dpType}
                  onChange={e => setInputs(s => ({ ...s, dpType: e.target.value }))}
                  style={select(errors.dpType)}
                  disabled={pvTargetMode}
                  title={pvTargetMode ? 'Ignored in PV-target modes' : undefined}
                >
                  <option value="amount">{t('amount', language)}</option>
                  <option value="percentage">{t('percentage', language)}</option>
                </select>
                {errors.dpType && <small style={styles.error}>{errors.dpType}</small>}
              </div>
              <div>
                <label style={styles.label}>{t('down_payment_value', language)}</label>
                {pvTargetMode ? (
                  <input type="number" value={0} disabled style={input()} title="Ignored in PV-target modes" />
                ) : inputs.dpType === 'percentage' ? (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={inputs.downPaymentValue}
                      onChange={e => setInputs(s => ({ ...s, downPaymentValue: e.target.value }))}
                      style={{ ...input(errors.downPaymentValue), paddingRight: 36 }}
                      placeholder="e.g., 20"
                    />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontWeight: 600 }}>%</span>
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputs.downPaymentValue}
                    onChange={e => setInputs(s => ({ ...s, downPaymentValue: e.target.value }))}
                    style={input(errors.downPaymentValue)}
                    placeholder="e.g., 100000"
                  />
                )}
                {errors.downPaymentValue && <small style={styles.error}>{errors.downPaymentValue}</small>}
              </div>
            </>
          )
        })()}

        <div>
          <label style={styles.label}>{t('plan_duration_years', language)}</label>
          <input type="number" value={inputs.planDurationYears} onChange={e => setInputs(s => ({ ...s, planDurationYears: e.target.value }))} style={input(errors.planDurationYears)} />
          {errors.planDurationYears && <small style={styles.error}>{errors.planDurationYears}</small>}
        </div>

        <div>
          <label style={styles.label}>{t('handover_year', language)}</label>
          <input type="number" value={inputs.handoverYear} onChange={e => setInputs(s => ({ ...s, handoverYear: e.target.value }))} style={input(errors.handoverYear)} />
          {errors.handoverYear && <small style={styles.error}>{errors.handoverYear}</small>}
        </div>
        <div>
          <label style={styles.label}>{t('additional_handover_payment', language)}</label>
          <input type="number" value={inputs.additionalHandoverPayment} onChange={e => setInputs(s => ({ ...s, additionalHandoverPayment: e.target.value }))} style={input(errors.additionalHandoverPayment)} />
          {errors.additionalHandoverPayment && <small style={styles.error}>{errors.additionalHandoverPayment}</small>}
        </div>

        <div style={styles.blockFull}>
          <label style={{ ...styles.label, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={inputs.splitFirstYearPayments} onChange={e => setInputs(s => ({ ...s, splitFirstYearPayments: e.target.checked }))} />
            {t('split_first_year', language)}
          </label>
        </div>

        {inputs.splitFirstYearPayments && (
          <FirstYearPayments
            styles={styles}
            language={language}
            firstYearPayments={firstYearPayments}
            errors={errors}
            addFirstYearPayment={addFirstYearPayment}
            updateFirstYearPayment={updateFirstYearPayment}
            removeFirstYearPayment={removeFirstYearPayment}
          />
        )}

        <SubsequentYears
          styles={styles}
          subsequentYears={subsequentYears}
          errors={errors}
          addSubsequentYear={addSubsequentYear}
          updateSubsequentYear={updateSubsequentYear}
          removeSubsequentYear={removeSubsequentYear}
        />

        <LivePreview
          styles={styles}
          language={language}
          setPreview={setPreview}
          setPreviewError={setPreviewError}
          validateForm={validateForm}
          buildPayload={buildPayload}
          mode={mode}
          stdPlan={stdPlan}
          inputs={inputs}
          firstYearPayments={firstYearPayments}
          subsequentYears={subsequentYears}
        />

        <PlanActions styles={styles} genLoading={genLoading} onGenerate={onGeneratePlan} />
      </form>
    </section>
  )
}