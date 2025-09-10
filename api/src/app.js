import express from 'express'
import cors from 'cors'
import {
  calculateByMode,
  CalculationModes,
  Frequencies,
  getPaymentMonths
} from '../services/calculationService.js'

const app = express()

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}))
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from Express API' })
})

/**
 * Minimal validation helpers
 */
function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}
function isBoolean(v) {
  return typeof v === 'boolean'
}
function bad(res, code, message, details) {
  return res.status(code).json({
    error: { message, details },
    timestamp: new Date().toISOString()
  })
}

const allowedModes = new Set(Object.values(CalculationModes))
const allowedFrequencies = new Set(Object.values(Frequencies))

/**
 * Validate inputs payload more granularly
 */
function validateInputs(inputs) {
  const errors = []

  // Required fields
  if (inputs.installmentFrequency && !allowedFrequencies.has(inputs.installmentFrequency)) {
    errors.push({ field: 'installmentFrequency', message: 'Invalid frequency' })
  }
  if (inputs.planDurationYears == null) {
    errors.push({ field: 'planDurationYears', message: 'Required' })
  } else {
    const yrs = Number(inputs.planDurationYears)
    if (!Number.isInteger(yrs) || yrs <= 0) errors.push({ field: 'planDurationYears', message: 'Must be integer >= 1' })
  }

  // dpType and value
  if (inputs.dpType && !['amount', 'percentage'].includes(inputs.dpType)) {
    errors.push({ field: 'dpType', message: 'Must be "amount" or "percentage"' })
  }
  if (inputs.downPaymentValue != null) {
    const v = Number(inputs.downPaymentValue)
    if (!isFinite(v) || v < 0) errors.push({ field: 'downPaymentValue', message: 'Must be non-negative number' })
  }

  // Handover
  if (inputs.handoverYear != null) {
    const hy = Number(inputs.handoverYear)
    if (!Number.isInteger(hy) || hy <= 0) errors.push({ field: 'handoverYear', message: 'Must be integer >= 1' })
  }
  if (inputs.additionalHandoverPayment != null) {
    const ah = Number(inputs.additionalHandoverPayment)
    if (!isFinite(ah) || ah < 0) errors.push({ field: 'additionalHandoverPayment', message: 'Must be non-negative number' })
  }

  // Flags and arrays
  if (inputs.splitFirstYearPayments != null && !isBoolean(inputs.splitFirstYearPayments)) {
    errors.push({ field: 'splitFirstYearPayments', message: 'Must be boolean' })
  }

  if (Array.isArray(inputs.firstYearPayments)) {
    inputs.firstYearPayments.forEach((p, idx) => {
      const amt = Number(p?.amount)
      const month = Number(p?.month)
      if (!isFinite(amt) || amt < 0) errors.push({ field: `firstYearPayments[${idx}].amount`, message: 'Must be non-negative number' })
      if (!Number.isInteger(month) || month < 1 || month > 12) errors.push({ field: `firstYearPayments[${idx}].month`, message: 'Must be integer 1..12' })
      if (p?.type && !['dp', 'regular'].includes(p.type)) errors.push({ field: `firstYearPayments[${idx}].type`, message: 'Must be "dp" or "regular"' })
    })
  }

  if (Array.isArray(inputs.subsequentYears)) {
    inputs.subsequentYears.forEach((y, idx) => {
      const total = Number(y?.totalNominal)
      if (!isFinite(total) || total < 0) errors.push({ field: `subsequentYears[${idx}].totalNominal`, message: 'Must be non-negative number' })
      if (!allowedFrequencies.has(y?.frequency)) errors.push({ field: `subsequentYears[${idx}].frequency`, message: 'Invalid frequency' })
    })
  }

  return errors
}

// --- Helpers for written amounts (simple, covers up to billions) ---
const EN_UNDER_20 = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
const EN_TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
function numberToWordsEn(n) {
  n = Math.round(Number(n) || 0)
  if (n < 0) return 'minus ' + numberToWordsEn(-n)
  if (n < 20) return EN_UNDER_20[n]
  if (n < 100) {
    const t = Math.floor(n/10), r = n%10
    return EN_TENS[t] + (r ? '-' + EN_UNDER_20[r] : '')
  }
  if (n < 1000) {
    const h = Math.floor(n/100), r = n%100
    return EN_UNDER_20[h] + ' hundred' + (r ? ' ' + numberToWordsEn(r) : '')
  }
  if (n < 1_000_000) {
    const th = Math.floor(n/1000), r = n%1000
    return numberToWordsEn(th) + ' thousand' + (r ? ' ' + numberToWordsEn(r) : '')
  }
  if (n < 1_000_000_000) {
    const m = Math.floor(n/1_000_000), r = n%1_000_000
    return numberToWordsEn(m) + ' million' + (r ? ' ' + numberToWordsEn(r) : '')
  }
  const b = Math.floor(n/1_000_000_000), r = n%1_000_000_000
  return numberToWordsEn(b) + ' billion' + (r ? ' ' + numberToWordsEn(r) : '')
}

// Very simplified Arabic number words (integer part); grammatical accuracy is limited
const AR_UNDER_20 = ['صفر','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر']
const AR_TENS = ['','', 'عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون']
function numberToWordsAr(n) {
  n = Math.round(Number(n) || 0)
  if (n < 0) return 'سالب ' + numberToWordsAr(-n)
  if (n < 20) return AR_UNDER_20[n]
  if (n < 100) {
    const t = Math.floor(n/10), r = n%10
    if (r === 0) return AR_TENS[t]
    if (r === 1) return 'واحد و' + AR_TENS[t]
    if (r === 2) return 'اثنان و' + AR_TENS[t]
    return AR_UNDER_20[r] + ' و' + AR_TENS[t]
  }
  if (n < 1000) {
    const h = Math.floor(n/100), r = n%100
    const hundreds = ['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'][h]
    return hundreds + (r ? ' و' + numberToWordsAr(r) : '')
  }
  if (n < 1_000_000) {
    const th = Math.floor(n/1000), r = n%1000
    let thousands = ''
    if (th === 1) thousands = 'ألف'
    else if (th === 2) thousands = 'ألفان'
    else if (th <= 10) thousands = numberToWordsAr(th) + ' آلاف'
    else thousands = numberToWordsAr(th) + ' ألف'
    return thousands + (r ? ' و' + numberToWordsAr(r) : '')
  }
  if (n < 1_000_000_000) {
    const m = Math.floor(n/1_000_000), r = n%1_000_000
    let millions = ''
    if (m === 1) millions = 'مليون'
    else if (m === 2) millions = 'مليونان'
    else if (m <= 10) millions = numberToWordsAr(m) + ' ملايين'
    else millions = numberToWordsAr(m) + ' مليون'
    return millions + (r ? ' و' + numberToWordsAr(r) : '')
  }
  const b = Math.floor(n/1_000_000_000), r = n%1_000_000_000
  let billions = ''
  if (b === 1) billions = 'مليار'
  else if (b === 2) billions = 'ملياران'
  else if (b <= 10) billions = numberToWordsAr(b) + ' مليارات'
  else billions = numberToWordsAr(b) + ' مليار'
  return billions + (r ? ' و' + numberToWordsAr(r) : '')
}

function toWrittenAmount(amount, lang) {
  const integer = Math.round(Number(amount) || 0)
  if (lang === 'ar' || lang?.toLowerCase().startsWith('arab')) {
    return numberToWordsAr(integer) + ' جنيه'
  }
  return numberToWordsEn(integer) + ' pounds'
}

/**
 * POST /api/calculate
 * Body: { mode, stdPlan, inputs }
 *
 * stdPlan: { totalPrice, financialDiscountRate, calculatedPV }
 * inputs:  {
 *   salesDiscountPercent, dpType, downPaymentValue, planDurationYears,
 *   installmentFrequency, additionalHandoverPayment, handoverYear,
 *   splitFirstYearPayments, firstYearPayments[], subsequentYears[]
 * }
 */
app.post('/api/calculate', (req, res) => {
  try {
    const { mode, stdPlan, inputs } = req.body || {}

    if (!mode || !allowedModes.has(mode)) {
      return bad(res, 400, 'Invalid or missing mode', { allowedModes: [...allowedModes] })
    }
    if (!isObject(stdPlan)) {
      return bad(res, 400, 'stdPlan must be an object with totalPrice, financialDiscountRate, calculatedPV')
    }
    // Basic presence checks
    const stdTotal = Number(stdPlan.totalPrice)
    const stdRate = Number(stdPlan.financialDiscountRate)
    const stdPV = Number(stdPlan.calculatedPV)
    if (!isFinite(stdTotal) || stdTotal < 0) {
      return bad(res, 400, 'stdPlan.totalPrice must be a non-negative number')
    }
    if (!isFinite(stdRate)) {
      return bad(res, 400, 'stdPlan.financialDiscountRate must be a number (percent)')
    }
    if (!isFinite(stdPV) || stdPV < 0) {
      return bad(res, 400, 'stdPlan.calculatedPV must be a non-negative number')
    }

    if (!isObject(inputs)) {
      return bad(res, 400, 'inputs must be an object')
    }
    const inputErrors = validateInputs(inputs)
    if (inputErrors.length > 0) {
      return bad(res, 422, 'Invalid inputs', inputErrors)
    }

    const result = calculateByMode(mode, stdPlan, inputs)
    return res.json({ ok: true, data: result })
  } catch (err) {
    console.error('POST /api/calculate error:', err)
    return bad(res, 500, 'Internal error during calculation')
  }
})

/**
 * POST /api/generate-plan
 * Body: { mode, stdPlan, inputs, languageForWrittenAmounts }
 * Returns: { ok: true, schedule: [{label, month, amount, writtenAmount}], totals, meta }
 */
app.post('/api/generate-plan', (req, res) => {
  try {
    const { mode, stdPlan, inputs, languageForWrittenAmounts } = req.body || {}
    if (!mode || !allowedModes.has(mode)) {
      return bad(res, 400, 'Invalid or missing mode', { allowedModes: [...allowedModes] })
    }
    if (!isObject(stdPlan) || !isObject(inputs)) {
      return bad(res, 400, 'Missing stdPlan or inputs')
    }
    const inputErrors = validateInputs(inputs)
    if (inputErrors.length > 0) {
      return bad(res, 422, 'Invalid inputs', inputErrors)
    }

    const lang = (languageForWrittenAmounts || 'English').toLowerCase().startsWith('ar') ? 'ar' : 'en'

    const result = calculateByMode(mode, stdPlan, inputs)

    const schedule = []
    const pushEntry = (label, month, amount) => {
      const amt = Number(amount) || 0
      if (amt <= 0) return
      schedule.push({
        label,
        month: Number(month) || 0,
        amount: amt,
        writtenAmount: toWrittenAmount(amt, lang)
      })
    }

    // Down payment or split first year
    const splitY1 = !!inputs.splitFirstYearPayments
    if (splitY1) {
      for (const p of (inputs.firstYearPayments || [])) {
        pushEntry(p.type === 'dp' ? 'Down Payment (Y1 split)' : 'First Year', p.month, p.amount)
      }
    } else {
      // single down payment at month 0
      pushEntry('Down Payment', 0, result.downPaymentAmount)
    }

    // Subsequent custom years (expand totals into installments)
    const subs = inputs.subsequentYears || []
    subs.forEach((y, idx) => {
      let nInYear = 0
      switch (y.frequency) {
        case Frequencies.Monthly: nInYear = 12; break;
        case Frequencies.Quarterly: nInYear = 4; break;
        case Frequencies.BiAnnually: nInYear = 2; break;
        case Frequencies.Annually: nInYear = 1; break;
        default: nInYear = 0;
      }
      const per = (Number(y.totalNominal) || 0) / (nInYear || 1)
      // determine absolute year number
      const startAfterYear = (splitY1 ? 1 : 0) + idx
      const months = getPaymentMonths(nInYear, y.frequency, startAfterYear)
      months.forEach((m, i) => pushEntry(`Year ${startAfterYear + 1} (${y.frequency})`, m, per))
    })

    // Additional handover
    if ((Number(inputs.additionalHandoverPayment) || 0) > 0 && (Number(inputs.handoverYear) || 0) > 0) {
      pushEntry('Handover', Number(inputs.handoverYear) * 12, inputs.additionalHandoverPayment)
    }

    // Equal installments
    const eqMonths = result.equalInstallmentMonths || []
    const eqAmt = Number(result.equalInstallmentAmount) || 0
    eqMonths.forEach((m, i) => pushEntry('Equal Installment', m, eqAmt))

    // Sort by month then by label for consistency
    schedule.sort((a, b) => (a.month - b.month) || a.label.localeCompare(b.label))

    const totals = {
      count: schedule.length,
      totalNominal: schedule.reduce((s, e) => s + e.amount, 0)
    }

    return res.json({ ok: true, schedule, totals, meta: result.meta || {} })
  } catch (err) {
    console.error('POST /api/generate-plan error:', err)
    return bad(res, 500, 'Internal error during plan generation')
  }
})

export default app