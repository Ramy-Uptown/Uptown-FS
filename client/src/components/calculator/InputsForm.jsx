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
            <option value="evaluateCustomPrice">{isRTL(language) ? 'سعر قياسي بعد الخصم (مقارنة بالقياسي)' : 'Discounted Standard Price (Compare to Standard)'}</option>
            <option value="calculateForTargetPV">{isRTL(language) ? 'سعر مستهدف: مطابقة القيمة الحالية القياسية' : 'Target Price: Match Standard PV'}</option>
            <option value="customYearlyThenEqual_useStdPrice">{isRTL(language) ? 'هيكل مخصص باستخدام السعر القياسي' : 'Custom Structure using Standard Price'}</option>
            <option value="customYearlyThenEqual_targetPV">{isRTL(language) ? 'هيكل مخصص بهدف مطابقة القيمة الحالية القياسية' : 'Custom Structure targeting Standard PV'}</option>
          </select>
          {(() => {
            const info = {
              evaluateCustomPrice: {
                en: {
                  name: 'Discounted Standard Price (Compare to Standard)',
                  desc: 'Applies Sales Discount to the Standard Price, computes the plan (including your DP and structure), then compares the resulting schedule against acceptance thresholds.'
                },
                ar: {
                  name: 'سعر قياسي بعد الخصم (مقارنة بالقياسي)',
                  desc: 'يطبق خصم المبيعات على السعر القياسي ويُكوّن الخطة (بما في ذلك الدفعة المقدمة وهيكل السداد) ثم يقارن الجدول بحدود القبول.'
                }
              },
              calculateForTargetPV: {
                en: {
                  name: 'Target Price: Match Standard PV',
                  desc: 'Solves for installments so that Present Value equals the Standard PV using your chosen structure (including your DP). Then the schedule is evaluated against acceptance thresholds.'
                },
                ar: {
                  name: 'سعر مستهدف: مطابقة القيمة الحالية القياسية',
                  desc: 'يحسب الأقساط بحيث تساوي القيمة الحالية القيمة القياسية باستخدام الهيكل الذي تختاره (بما في ذلك الدفعة المقدمة)، ثم يتم تقييم الجدول مقابل حدود القبول.'
                }
              },
              customYearlyThenEqual_useStdPrice: {
                en: {
                  name: 'Custom Structure using Standard Price',
                  desc: 'Keeps the Standard Price but lets you define split First Year and subsequent years; the remainder is equal installments. The result is compared to acceptance thresholds.'
                },
                ar: {
                  name: 'هيكل مخصص باستخدام السعر القياسي',
                  desc: 'يُبقي على السعر القياسي مع تمكينك من تقسيم السنة الأولى وتحديد السنوات اللاحقة؛ ويتم توزيع الباقي كأقساط متساوية. ثم تُقارن النتيجة بحدود القبول.'
                }
              },
              customYearlyThenEqual_targetPV: {
                en: {
                  name: 'Custom Structure targeting Standard PV',
                  desc: 'Define split First Year and subsequent years; the remainder is equal installments. Solves so that Present Value equals the Standard PV, then evaluates the schedule against acceptance thresholds.'
                },
                ar: {
                  name: 'هيكل مخصص بهدف مطابقة القيمة الحالية القياسية',
                  desc: 'حدد تقسيم السنة الأولى والسنوات اللاحقة؛ ويتم توزيع الباقي كأقساط متساوية. يحسب بحيث تساوي القيمة الحالية القيمة القياسية ثم يقيم الجدول مقابل حدود القبول.'
                }
              }
            }
            const l = isRTL(language) ? 'ar' : 'en'
            const m = info[mode] || info.evaluateCustomPrice
            return (
              <div style={{ marginTop: 8, background: '#fbfaf7', border: '1px dashed #ead9bd', borderRadius: 8, padding: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{m[l].name}</div>
                <div style={{ fontSize: 13, color: '#4b5563' }}>{m[l].desc}</div>
              </div>
            )
          })()}
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

        <div>
          <label style={styles.label}>{t('dp_type', language)}</label>
          <select value={inputs.dpType} onChange={e => setInputs(s => ({ ...s, dpType: e.target.value }))} style={select(errors.dpType)}>
            <option value="amount">{t('amount', language)}</option>
            <option value="percentage">{t('percentage', language)}</option>
          </select>
          {errors.dpType && <small style={styles.error}>{errors.dpType}</small>}
        </div>
        <div>
          <label style={styles.label}>{t('down_payment_value', language)}</label>
          {inputs.dpType === 'percentage' ? (
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