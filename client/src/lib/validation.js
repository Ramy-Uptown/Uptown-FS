/**
 * Validation helper for calculator form.
 * Returns { errors, valid } where errors is a flat map of field -> message.
 */
export function validateCalculatorForm(stdPlan, inputs, firstYearPayments, subsequentYears) {
  const e = {}

  const sp = {
    totalPrice: Number(stdPlan?.totalPrice),
    financialDiscountRate: Number(stdPlan?.financialDiscountRate),
    calculatedPV: Number(stdPlan?.calculatedPV)
  }
  const inp = { ...inputs }

  if (!isFinite(sp.totalPrice) || sp.totalPrice < 0) e.std_totalPrice = 'Must be non-negative number'
  if (!isFinite(sp.financialDiscountRate)) e.std_financialDiscountRate = 'Must be a number'
  if (!isFinite(sp.calculatedPV) || sp.calculatedPV < 0) e.std_calculatedPV = 'Must be non-negative number'

  if (!['monthly', 'quarterly', 'bi-annually', 'annually'].includes(inp.installmentFrequency)) {
    e.installmentFrequency = 'Invalid'
  }
  if (!Number.isInteger(Number(inp.planDurationYears)) || Number(inp.planDurationYears) <= 0) {
    e.planDurationYears = 'Must be integer >= 1'
  }
  if (inp.dpType && !['amount', 'percentage'].includes(inp.dpType)) e.dpType = 'Invalid'
  if (!isFinite(Number(inp.downPaymentValue)) || Number(inp.downPaymentValue) < 0) e.downPaymentValue = 'Must be non-negative number'
  if (!Number.isInteger(Number(inp.handoverYear)) || Number(inp.handoverYear) <= 0) e.handoverYear = 'Must be integer >= 1'
  if (!isFinite(Number(inp.additionalHandoverPayment)) || Number(inp.additionalHandoverPayment) < 0) e.additionalHandoverPayment = 'Must be non-negative number'

  if (inp.splitFirstYearPayments) {
    (firstYearPayments || []).forEach((p, idx) => {
      const keyAmt = `fyp_amount_${idx}`
      const keyMonth = `fyp_month_${idx}`
      if (!isFinite(Number(p?.amount)) || Number(p?.amount) < 0) e[keyAmt] = '>= 0'
      const m = Number(p?.month)
      if (!Number.isInteger(m) || m < 1 || m > 12) e[keyMonth] = '1..12'
    })
  }

  (subsequentYears || []).forEach((y, idx) => {
    const keyTot = `sub_total_${idx}`
    const keyFreq = `sub_freq_${idx}`
    if (!isFinite(Number(y?.totalNominal)) || Number(y?.totalNominal) < 0) e[keyTot] = '>= 0'
    if (!['monthly', 'quarterly', 'bi-annually', 'annually'].includes(y?.frequency)) e[keyFreq] = 'Invalid'
  })

  return { errors: e, valid: Object.keys(e).length === 0 }
}