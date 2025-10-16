import React from 'react'
import LivePreview from './LivePreview.jsx'
import PlanActions from './PlanActions.jsx'
import FirstYearPayments from './FirstYearPayments.jsx'
import SubsequentYears from './SubsequentYears.jsx'

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

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Inputs</h2>
      <form onSubmit={(e) => { e.preventDefault(); onGeneratePlan(e) }} style={{ ...styles.grid2 }}>
        <div>
          <label style={styles.label}>Language for Written Amounts</label>
          <select value={language} onChange={e => setLanguage(e.target.value)} style={select()}>
            <option value="en">English</option>
            <option value="ar">Arabic</option>
          </select>
        </div>

        <div>
          <label style={styles.label}>Currency (English only)</label>
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
          <label style={styles.label}>Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value)} style={select()}>
            <option value="evaluateCustomPrice">evaluateCustomPrice</option>
            <option value="calculateForTargetPV">calculateForTargetPV</option>
            <option value="customYearlyThenEqual_useStdPrice">customYearlyThenEqual_useStdPrice</option>
            <option value="customYearlyThenEqual_targetPV">customYearlyThenEqual_targetPV</option>
          </select>
        </div>

        <div>
          <label style={styles.label}>Installment Frequency</label>
          <select value={inputs.installmentFrequency} onChange={e => setInputs(s => ({ ...s, installmentFrequency: e.target.value }))} style={select(errors.installmentFrequency)}>
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
            <option value="bi-annually">bi-annually</option>
            <option value="annually">annually</option>
          </select>
          {errors.installmentFrequency && <small style={styles.error}>{errors.installmentFrequency}</small>}
        </div>

        <div>
          <label style={styles.label}>Std Total Price</label>
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
            <div><strong>Unit Breakdown</strong></div>
            <div>Base: {Number(unitPricingBreakdown.base || 0).toLocaleString()}</div>
            <div>Garden: {Number(unitPricingBreakdown.garden || 0).toLocaleString()}</div>
            <div>Roof: {Number(unitPricingBreakdown.roof || 0).toLocaleString()}</div>
            <div>Storage: {Number(unitPricingBreakdown.storage || 0).toLocaleString()}</div>
            <div>Garage: {Number(unitPricingBreakdown.garage || 0).toLocaleString()}</div>
            <div style={{ marginTop: 4 }}><strong>Total (excl. maintenance): {Number(unitPricingBreakdown.totalExclMaintenance || 0).toLocaleString()}</strong></div>
            <div>Maintenance (scheduled separately): {Number(unitPricingBreakdown.maintenance || 0).toLocaleString()}</div>
          </div>
        </div>
        {role !== 'property_consultant' && (
          <div>
            <label style={styles.label}>Std Financial Rate (%)</label>
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
          <label style={styles.label}>Std Calculated PV</label>
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
          <label style={styles.label}>Sales Discount (%)</label>
          <input type="number" value={inputs.salesDiscountPercent} onChange={e => setInputs(s => ({ ...s, salesDiscountPercent: e.target.value }))} style={input()} />
          {DiscountHint && <DiscountHint role={undefined} value={inputs.salesDiscountPercent} />}
        </div>

        <div>
          <label style={styles.label}>DP Type</label>
          <select value={inputs.dpType} onChange={e => setInputs(s => ({ ...s, dpType: e.target.value }))} style={select(errors.dpType)}>
            <option value="amount">amount</option>
            <option value="percentage">percentage</option>
          </select>
          {errors.dpType && <small style={styles.error}>{errors.dpType}</small>}
        </div>
        <div>
          <label style={styles.label}>Down Payment Value</label>
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
          <label style={styles.label}>Plan Duration (years)</label>
          <input type="number" value={inputs.planDurationYears} onChange={e => setInputs(s => ({ ...s, planDurationYears: e.target.value }))} style={input(errors.planDurationYears)} />
          {errors.planDurationYears && <small style={styles.error}>{errors.planDurationYears}</small>}
        </div>

        <div>
          <label style={styles.label}>Handover Year</label>
          <input type="number" value={inputs.handoverYear} onChange={e => setInputs(s => ({ ...s, handoverYear: e.target.value }))} style={input(errors.handoverYear)} />
          {errors.handoverYear && <small style={styles.error}>{errors.handoverYear}</small>}
        </div>
        <div>
          <label style={styles.label}>Additional Handover Payment</label>
          <input type="number" value={inputs.additionalHandoverPayment} onChange={e => setInputs(s => ({ ...s, additionalHandoverPayment: e.target.value }))} style={input(errors.additionalHandoverPayment)} />
          {errors.additionalHandoverPayment && <small style={styles.error}>{errors.additionalHandoverPayment}</small>}
        </div>

        <div style={styles.blockFull}>
          <label style={{ ...styles.label, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={inputs.splitFirstYearPayments} onChange={e => setInputs(s => ({ ...s, splitFirstYearPayments: e.target.checked }))} />
            Split First Year Payments?
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