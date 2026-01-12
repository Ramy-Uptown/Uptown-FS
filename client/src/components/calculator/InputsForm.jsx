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
  role,
  // additional one-time fees (maintenance deposit)
  feeSchedule,
  setFeeSchedule
}) {

  const todayStr = new Date().toISOString().slice(0, 10)
  const isStandardMode = mode === 'standardMode'

  // Apply document direction whenever language changes
  useEffect(() => {
    applyDocumentDirection(language)
  }, [language])

  return (
    <section className={styles.section} dir={isRTL(language) ? 'rtl' : 'ltr'}>
      <h2 className={`${styles.sectionTitle} ${isRTL(language) ? 'text-right' : 'text-left'}`}>{t('inputs', language)}</h2>
      <form onSubmit={(e) => { e.preventDefault(); onGeneratePlan(e) }} className={styles.grid2}>
        <div>
          <label className={styles.label}>{t('language_for_written_amounts', language)}</label>
          <select value={language} onChange={e => setLanguage(e.target.value)} className={styles.select}>
            <option value="en">{t('english', language)}</option>
            <option value="ar">{t('arabic', language)}</option>
          </select>
        </div>

        <div>
          <label className={styles.label}>{t('currency', language)}</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className={styles.select}>
            <option value="EGP">EGP (Egyptian Pounds)</option>
            <option value="USD">USD (US Dollars)</option>
            <option value="SAR">SAR (Saudi Riyals)</option>
            <option value="EUR">EUR (Euros)</option>
            <option value="AED">AED (UAE Dirhams)</option>
            <option value="KWD">Kuwaiti Dinars</option>
          </select>
        </div>

        <div>
          <label className={styles.label}>{t('offer_date', language)}<span className="text-red-500"> *</span></label>
          <input
            type="date"
            value={inputs.offerDate || todayStr}
            onChange={e => setInputs(s => ({ ...s, offerDate: e.target.value, firstPaymentDate: s.firstPaymentDate || e.target.value }))}
            className={`${styles.input} ${errors.offerDate ? 'border-red-500' : ''}`}
            required
          />
          {errors.offerDate && <small className={styles.error}>{errors.offerDate}</small>}
        </div>

        <div>
          <label className={styles.label}>{t('first_payment_date', language)}<span className="text-red-500"> *</span></label>
          <input
            type="date"
            value={inputs.firstPaymentDate || inputs.offerDate || todayStr}
            onChange={e => setInputs(s => ({ ...s, firstPaymentDate: e.target.value }))}
            className={`${styles.input} ${errors.firstPaymentDate ? 'border-red-500' : ''}`}
            required
          />
          {errors.firstPaymentDate && <small className={styles.error}>{errors.firstPaymentDate}</small>}
        </div>

        <div>
          <label className={styles.label}>{t('mode', language)}</label>
          <select value={mode} onChange={e => setMode(e.target.value)} className={styles.select}>
            <option value="standardMode">{isRTL(language) ? 'الوضع القياسي (سياسة التمويل الافتراضية)' : 'Standard Mode (Default Financing Policy)'}</option>
            <option value="evaluateCustomPrice">{isRTL(language) ? 'سعر القائمة بعد الخصم (مقارنة بالقياسي)' : 'Discounted List Price (Compare to Standard)'}</option>
            <option value="calculateForTargetPV">{isRTL(language) ? 'سعر مستهدف: مطابقة القيمة الحالية القياسية' : 'Target Price: Match Standard PV'}</option>
            <option value="customYearlyThenEqual_useStdPrice">{isRTL(language) ? 'هيكل مخصص باستخدام سعر القائمة' : 'Custom Structure using List Price'}</option>
            <option value="customYearlyThenEqual_targetPV">{isRTL(language) ? 'هيكل مخصص بهدف مطابقة القيمة الحالية القياسية' : 'Custom Structure targeting Standard PV'}</option>
          </select>
          {(() => {
            const info = {
              standardMode: {
                en: {
                  name: 'Standard Mode (Default Financing Policy)',
                  desc: 'Uses the approved List Price under the Default Financing Policy with a fixed structure: 20% Down Payment (percentage), 6 years quarterly; Years 1–3 pay 15% per year (3.75% per quarter) and the remaining 35% is spread equally over Years 4–6. Handover is fixed at Year 3. Discount is allowed (up to 2% for consultants) but any non-zero discount will always require an override.'
                },
                ar: {
                  name: 'الوضع القياسي (سياسة التمويل الافتراضية)',
                  desc: 'يستخدم سعر القائمة المعتمد ضمن سياسة التمويل الافتراضية مع هيكل ثابت: ٢٠٪ دفعة مقدمة (كنسبة مئوية)، مدة ٦ سنوات بواقع ربع سنوي؛ السنوات ١–٣ تسدد ١٥٪ سنوياً (٣٫٧٥٪ لكل ربع سنة) والباقي ٣٥٪ يوزع بالتساوي على السنوات ٤–٦. سنة التسليم ثابتة عند السنة الثالثة. يُسمح بالخصم (حتى ٢٪ للمستشار) ولكن أي خصم أكبر من صفر يتطلب دائماً طلب استثناء (Override).'
                }
              },
              evaluateCustomPrice: {
                en: {
                  name: 'Discounted List Price (Compare to Standard)',
                  desc: 'Applies Sales Discount to the List Price, computes the plan (including your Down Payment and structure), then compares the resulting schedule against acceptance thresholds. Default Down Payment is 20% as a percentage, but you can switch between percentage and amount.'
                },
                ar: {
                  name: 'سعر القائمة بعد الخصم (مقارنة بالقياسي)',
                  desc: 'يطبق خصم المبيعات على سعر القائمة ويُكوّن الخطة (بما في ذلك الدفعة المقدمة وهيكل السداد) ثم يقارن الجدول بحدود القبول. الدفعة المقدمة الافتراضية ٢٠٪ كنسبة مئوية، ويمكنك التبديل بين النسبة والقيمة.'
                }
              },
              calculateForTargetPV: {
                en: {
                  name: 'Target Price: Match Standard PV',
                  desc: 'Solves for installments so that Present Value equals the Standard PV using your chosen structure. In this mode the Down Payment must be an absolute amount (not a percentage); any percentage entered previously is converted once to a value based on the Standard Price.'
                },
                ar: {
                  name: 'سعر مستهدف: مطابقة القيمة الحالية القياسية',
                  desc: 'يحسب الأقساط بحيث تساوي القيمة الحالية القيمة القياسية باستخدام الهيكل الذي تختاره. في هذا الوضع يجب أن تكون الدفعة المقدمة قيمة ثابتة (وليس نسبة مئوية)، ويتم تحويل أي نسبة أدخلت سابقاً مرة واحدة إلى قيمة مبنية على السعر القياسي.'
                }
              },
              customYearlyThenEqual_useStdPrice: {
                en: {
                  name: 'Custom Structure using List Price',
                  desc: 'Keeps the List Price but lets you define split First Year and subsequent years; the remainder is equal installments. Default Down Payment is 20% as a percentage, but you can choose either percentage or amount.'
                },
                ar: {
                  name: 'هيكل مخصص باستخدام سعر القائمة',
                  desc: 'يُبقي على سعر القائمة مع تمكينك من تقسيم السنة الأولى وتحديد السنوات اللاحقة؛ ويتم توزيع الباقي كأقساط متساوية. الدفعة المقدمة الافتراضية ٢٠٪ كنسبة مئوية، ويمكنك اختيار النسبة أو القيمة.'
                }
              },
              customYearlyThenEqual_targetPV: {
                en: {
                  name: 'Custom Structure targeting Standard PV',
                  desc: 'Define split First Year and subsequent years; the remainder is equal installments. In this mode the Down Payment must be an absolute amount (not a percentage); any previous percentage is converted once to a value based on the Standard Price when you switch into this mode.'
                },
                ar: {
                  name: 'هيكل مخصص بهدف مطابقة القيمة الحالية القياسية',
                  desc: 'حدد تقسيم السنة الأولى والسنوات اللاحقة؛ ويتم توزيع الباقي كأقساط متساوية. في هذا الوضع يجب أن تكون الدفعة المقدمة قيمة ثابتة (وليس نسبة مئوية)، ويتم تحويل أي نسبة سابقة مرة واحدة إلى قيمة مبنية على السعر القياسي عند الانتقال إلى هذا الوضع.'
                }
              }
            }
            const l = isRTL(language) ? 'ar' : 'en'
            const m = info[mode] || info.standardMode
            return (
              <div className="mt-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3">
                <div className="font-bold mb-1">{m[l].name}</div>
                <div className="text-xs text-gray-600">{m[l].desc}</div>
              </div>
            )
          })()}
        </div>

        <div>
          <label className={styles.label}>{t('installment_frequency', language)}</label>
          <select
            value={isStandardMode ? 'quarterly' : inputs.installmentFrequency}
            onChange={e => !isStandardMode && setInputs(s => ({ ...s, installmentFrequency: e.target.value }))}
            className={`${styles.select} ${errors.installmentFrequency ? 'border-red-500' : ''}`}
            disabled={isStandardMode}
            title={isStandardMode ? (isRTL(language) ? 'الوضع القياسي يستخدم ربع سنوي ثابتاً' : 'Standard Mode uses fixed quarterly installments') : undefined}
          >
            <option value="monthly">{t('monthly', language)}</option>
            <option value="quarterly">{t('quarterly', language)}</option>
            <option value="bi-annually">{t('bi_annually', language)}</option>
            <option value="annually">{t('annually', language)}</option>
          </select>
          {errors.installmentFrequency && <small className={styles.error}>{errors.installmentFrequency}</small>}
        </div>

        <div>
          <label className={styles.label}>{t('std_total_price', language)}</label>
          <input
            type="number"
            value={stdPlan.totalPrice}
            onChange={e => setStdPlan(s => ({ ...s, totalPrice: e.target.value }))}
            className={`${styles.input} ${errors.std_totalPrice ? 'border-red-500' : ''}`}
            disabled={rateLocked}
            title={rateLocked ? 'Locked to server-approved standard for selected unit' : undefined}
          />
          {errors.std_totalPrice && <small className={styles.error}>{errors.std_totalPrice}</small>}
          <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-2">
            <div><strong>{t('unit_breakdown', language)}</strong></div>
            <div>{t('base', language)}: {Number(unitPricingBreakdown.base || 0).toLocaleString()}</div>
            <div>{t('garden', language)}: {Number(unitPricingBreakdown.garden || 0).toLocaleString()}</div>
            <div>{t('roof', language)}: {Number(unitPricingBreakdown.roof || 0).toLocaleString()}</div>
            <div>{t('storage', language)}: {Number(unitPricingBreakdown.storage || 0).toLocaleString()}</div>
            <div>{t('garage', language)}: {Number(unitPricingBreakdown.garage || 0).toLocaleString()}</div>
            <div className="mt-1"><strong>{t('total_excl_maint', language)}: {Number(unitPricingBreakdown.totalExclMaintenance || 0).toLocaleString()}</strong></div>
            <div>{t('maintenance', language)}: {Number(unitPricingBreakdown.maintenance || 0).toLocaleString()}</div>
          </div>
        </div>
        {role !== 'property_consultant' && (
          <div>
            <label className={styles.label}>{t('std_financial_rate', language)}</label>
            <input
              type="number"
              value={stdPlan.financialDiscountRate}
              onChange={e => setStdPlan(s => ({ ...s, financialDiscountRate: e.target.value }))}
              className={`${styles.input} ${errors.std_financialDiscountRate ? 'border-red-500' : ''}`}
              disabled={rateLocked}
              title={rateLocked ? 'Locked to server-approved standard for selected unit' : undefined}
            />
            {errors.std_financialDiscountRate && <small className={styles.error}>{errors.std_financialDiscountRate}</small>}
          </div>
        )}
        <div>
          <label className={styles.label}>{t('std_calculated_pv', language)}</label>
          <input
            type="number"
            value={stdPlan.calculatedPV}
            onChange={() => {}}
            className={`${styles.input} ${errors.std_calculatedPV ? 'border-red-500' : ''}`}
            disabled={true}
            title={'Read-only. Computed from Standard Total Price, rate, duration and frequency.'}
          />
          {errors.std_calculatedPV && <small className={styles.error}>{errors.std_calculatedPV}</small>}
        </div>

        <div>
          <label className={styles.label}>{t('sales_discount', language)}</label>
          <input
            type="number"
            value={inputs.salesDiscountPercent}
            onChange={e => setInputs(s => ({ ...s, salesDiscountPercent: e.target.value }))}
            className={styles.input}
          />
          {DiscountHint && <DiscountHint role={undefined} value={inputs.salesDiscountPercent} />}
        </div>

        <div>
          <label className={styles.label}>{t('dp_type', language)}</label>
          {isStandardMode ? (
            <select value="percentage" disabled className={`${styles.select} ${errors.dpType ? 'border-red-500' : ''}`}>
              <option value="percentage">{t('percentage', language)} (fixed)</option>
            </select>
          ) : ['calculateForTargetPV','customYearlyThenEqual_targetPV'].includes(mode) ? (
            <select value="amount" disabled className={`${styles.select} ${errors.dpType ? 'border-red-500' : ''}`}>
              <option value="amount">{t('amount', language)} (fixed)</option>
            </select>
          ) : (
            <select value={inputs.dpType} onChange={e => setInputs(s => ({ ...s, dpType: e.target.value }))} className={`${styles.select} ${errors.dpType ? 'border-red-500' : ''}`}>
              <option value="amount">{t('amount', language)}</option>
              <option value="percentage">{t('percentage', language)}</option>
            </select>
          )}
          {errors.dpType && <small className={styles.error}>{errors.dpType}</small>}
          {['calculateForTargetPV','customYearlyThenEqual_targetPV'].includes(mode) && !isStandardMode && (
            <small className={`${styles.metaText} block mt-1`}>
              {isRTL(language)
                ? 'تم تعطيل الدفعة المقدمة كنسبة مئوية في أوضاع مطابقة القيمة الحالية لتجنب الحلقة عند حل السعر من القيمة الحالية. الرجاء استخدام قيمة ثابتة.'
                : 'Percentage down payment is disabled in PV-target modes to avoid circular dependency when solving price from PV. Please use a fixed amount.'}
            </small>
          )}
        </div>
        <div>
          <label className={styles.label}>
            {isStandardMode
              ? `${t('down_payment_value', language)} (20%)`
              : ['calculateForTargetPV','customYearlyThenEqual_targetPV'].includes(mode)
                ? `${t('down_payment_value', language)} (amount)`
                : t('down_payment_value', language)}
          </label>
          {isStandardMode ? (
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={20}
                disabled
                className={`${styles.input} ${errors.downPaymentValue ? 'border-red-500' : ''} pr-10`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">%</span>
            </div>
          ) : inputs.dpType === 'percentage' && !['calculateForTargetPV','customYearlyThenEqual_targetPV'].includes(mode) ? (
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={inputs.downPaymentValue}
                onChange={e => setInputs(s => ({ ...s, downPaymentValue: e.target.value }))}
                className={`${styles.input} ${errors.downPaymentValue ? 'border-red-500' : ''} pr-10`}
                placeholder="e.g., 20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">%</span>
            </div>
          ) : (
            <input
              type="number"
              min="0"
              step="0.01"
              value={inputs.downPaymentValue}
              onChange={e => setInputs(s => ({ ...s, downPaymentValue: e.target.value, dpType: ['calculateForTargetPV','customYearlyThenEqual_targetPV'].includes(mode) ? 'amount' : s.dpType }))}
              className={`${styles.input} ${errors.downPaymentValue ? 'border-red-500' : ''}`}
              placeholder="e.g., 100000"
            />
          )}
          {errors.downPaymentValue && <small className={styles.error}>{errors.downPaymentValue}</small>}
        </div>

        <div>
          <label className={styles.label}>{t('plan_duration_years', language)}</label>
          <input
            type="number"
            value={isStandardMode ? 6 : inputs.planDurationYears}
            onChange={e => !isStandardMode && setInputs(s => ({ ...s, planDurationYears: e.target.value }))}
            className={`${styles.input} ${errors.planDurationYears ? 'border-red-500' : ''}`}
            disabled={isStandardMode}
            title={isStandardMode ? (isRTL(language) ? 'مدة الخطة ثابتة ٦ سنوات في الوضع القياسي' : 'Plan duration is fixed to 6 years in Standard Mode') : undefined}
          />
          {errors.planDurationYears && <small className={styles.error}>{errors.planDurationYears}</small>}
        </div>

        <div>
          <label className={styles.label}>{t('handover_year', language)}</label>
          <input
            type="number"
            value={isStandardMode ? 3 : inputs.handoverYear}
            onChange={e => !isStandardMode && setInputs(s => ({ ...s, handoverYear: e.target.value }))}
            className={`${styles.input} ${errors.handoverYear ? 'border-red-500' : ''}`}
            disabled={isStandardMode}
            title={isStandardMode ? (isRTL(language) ? 'سنة التسليم ثابتة عند السنة الثالثة في الوضع القياسي' : 'Handover year is fixed to Year 3 in Standard Mode') : undefined}
          />
          {errors.handoverYear && <small className={styles.error}>{errors.handoverYear}</small>}
        </div>
        <div>
          <label className={styles.label}>{t('additional_handover_payment', language)}</label>
          <input
            type="number"
            value={isStandardMode ? 0 : inputs.additionalHandoverPayment}
            onChange={e => !isStandardMode && setInputs(s => ({ ...s, additionalHandoverPayment: e.target.value }))}
            className={`${styles.input} ${errors.additionalHandoverPayment ? 'border-red-500' : ''}`}
            disabled={isStandardMode}
            title={isStandardMode ? (isRTL(language) ? 'لا توجد دفعة إضافية عند التسليم في الوضع القياسي' : 'No additional handover lump sum in Standard Mode') : undefined}
          />
          {errors.additionalHandoverPayment && <small className={styles.error}>{errors.additionalHandoverPayment}</small>}
        </div>

        {/* Maintenance Deposit controls (amount + optional calendar date) */}
        <div className={styles.blockFull}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={styles.label}>{isRTL(language) ? 'وديعة الصيانة (المبلغ)' : 'Maintenance Deposit (Amount)'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeSchedule?.maintenancePaymentAmount ?? ''}
                onChange={e => setFeeSchedule(s => ({ ...s, maintenancePaymentAmount: e.target.value }))}
                className={styles.input}
                placeholder={isRTL(language) ? 'مثال: 50000' : 'e.g., 50000'}
                disabled={isStandardMode}
                title={isStandardMode ? (isRTL(language) ? 'قيمة وديعة الصيانة مأخوذة من التسعير القياسي ولا يمكن تعديلها في الوضع القياسي.' : 'Maintenance Deposit amount comes from Standard Pricing and cannot be edited in Standard Mode.') : undefined}
              />
              <small className={styles.metaText}>
                {isRTL(language)
                  ? 'لا تدخل نسبة مئوية. هذه الرسوم ليست جزءًا من حساب القيمة الحالية ولكن تُضاف في جدول السداد.'
                  : 'Enter a fixed amount. This fee is not part of PV calculation but is appended to the payment schedule.'}
              </small>
            </div>
            <div>
              <label className={styles.label}>{isRTL(language) ? 'تاريخ وديعة الصيانة (اختياري)' : 'Maintenance Deposit Date (optional)'}</label>
              <input
                type="date"
                value={feeSchedule?.maintenancePaymentDate || ''}
                onChange={e => setFeeSchedule(s => ({ ...s, maintenancePaymentDate: e.target.value }))}
                className={styles.input}
              />
              <small className={styles.metaText}>
                {isRTL(language)
                  ? 'إذا تُرك فارغًا، يتم تحديد موعد وديعة الصيانة افتراضيًا عند التسليم.'
                  : 'If left empty, the maintenance deposit defaults to the Handover date.'}
              </small>
            </div>
          </div>
        </div>

        <div className={styles.blockFull}>
          <label className={`${styles.label} inline-flex items-center gap-2`}>
            <input
              type="checkbox"
              checked={isStandardMode ? false : inputs.splitFirstYearPayments}
              onChange={e => !isStandardMode && setInputs(s => ({ ...s, splitFirstYearPayments: e.target.checked }))}
              disabled={isStandardMode}
              title={isStandardMode ? (isRTL(language) ? 'هيكل السنوات الأولى ثابت في الوضع القياسي ولا يمكن تقسيمه.' : 'First year payments are fixed in Standard Mode and cannot be split.') : undefined}
            />
            {t('split_first_year', language)}
          </label>
        </div>

        {!isStandardMode && inputs.splitFirstYearPayments && (
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

        {!isStandardMode && (
          <SubsequentYears
            styles={styles}
            subsequentYears={subsequentYears}
            errors={errors}
            addSubsequentYear={addSubsequentYear}
            updateSubsequentYear={updateSubsequentYear}
            removeSubsequentYear={removeSubsequentYear}
          />
        )}

        {/* Display solved New Price for target-PV modes when preview is available */}
        {['calculateForTargetPV','customYearlyThenEqual_targetPV'].includes(mode) && summaries?.totalNominalPrice != null && (
          <div className={styles.blockFull}>
            <label className={styles.label}>{isRTL(language) ? 'السعر الجديد (محسوب)' : 'Solved New Price (from PV target)'}</label>
            <input
              type="number"
              value={Number(summaries.totalNominalPrice || 0).toFixed(2)}
              readOnly
              className={styles.input}
              title="Derived from matching Standard PV using your current structure"
            />
            <small className={styles.metaText}>
              {isRTL(language)
                ? 'القيمة محسوبة من مطابقة القيمة الحالية القياسية باستخدام الهيكل المختار.'
                : 'This is the offer price that matches the Standard PV given your selected structure.'}
            </small>
          </div>
        )}

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