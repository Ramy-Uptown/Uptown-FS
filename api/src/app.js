import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import {
  calculateByMode,
  CalculationModes,
  Frequencies,
  getPaymentMonths
} from '../services/calculationService.js'
import convertToWords from '../utils/converter.js'
import libre from 'libreoffice-convert'
import { promisify } from 'util'

const libreConvertAsync = promisify(libre.convert)

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
 * Body: { mode, stdPlan, inputs, language, currency? }
 * - language: 'en' or 'ar'
 * - currency: optional. For English, can be code (EGP, USD, SAR, EUR, AED, KWD) or full name (e.g., "Egyptian Pounds")
 * Returns: { ok: true, schedule: [{label, month, amount, writtenAmount}], totals, meta }
 */
app.post('/api/generate-plan', (req, res) => {
  try {
    const { mode, stdPlan, inputs, language, currency, languageForWrittenAmounts } = req.body || {}
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

    // Backward compatibility: support legacy languageForWrittenAmounts
    const langInput = language || languageForWrittenAmounts || 'en'
    const lang = String(langInput).toLowerCase().startsWith('ar') ? 'ar' : 'en'

    const result = calculateByMode(mode, stdPlan, inputs)

    const schedule = []
    const pushEntry = (label, month, amount) => {
      const amt = Number(amount) || 0
      if (amt <= 0) return
      schedule.push({
        label,
        month: Number(month) || 0,
        amount: amt,
        writtenAmount: convertToWords(amt, lang, { currency })
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

/**
 * POST /api/generate-document
 * Body: {
 *   templateName: string,              // must exist in /api/templates
 *   data: object,                      // flat key/value map for placeholders
 *   language?: 'en'|'ar',              // affects *_words auto-fields using convertToWords
 *   currency?: string                  // optional currency name/code for English words
 * }
 * Notes:
 * - Placeholders in the .docx should use Autocrat-style delimiters: <<placeholder_name>>
 * - Service will also add *_words fields for numeric values in data using the requested language
 */
app.post('/api/generate-document', async (req, res) => {
  try {
    const { templateName, data, language, currency } = req.body || {}

    if (!templateName || typeof templateName !== 'string') {
      return bad(res, 400, 'templateName is required and must be a string')
    }
    if (!isObject(data)) {
      return bad(res, 400, 'data must be an object with key/value pairs for placeholders')
    }

    const lang = String(language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en'

    // Resolve template path safely within /api/templates
    const templatesDir = path.join(process.cwd(), 'api', 'templates')
    const requestedPath = path.join(templatesDir, templateName)
    if (!requestedPath.startsWith(templatesDir)) {
      return bad(res, 400, 'Invalid template path')
    }
    if (!fs.existsSync(requestedPath)) {
      return bad(res, 404, `Template not found: ${templateName}`)
    }

    // Build rendering data:
    // - Original keys
    // - For numeric fields, add "<key>_words" using the convertToWords helper
    const renderData = { ...data }
    for (const [k, v] of Object.entries(data)) {
      const num = Number(v)
      if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && isFinite(num))) {
        renderData[`${k}_words`] = convertToWords(num, lang, { currency })
      }
    }

    // Read, compile and render the docx
    const content = fs.readFileSync(requestedPath, 'binary')
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '<<', end: '>>' } // Autocrat-style placeholders
    })

    doc.setData(renderData)
    try {
      doc.render()
    } catch (e) {
      console.error('Docxtemplater render error:', e)
      return bad(res, 400, 'Failed to render document. Check placeholders and provided data.')
    }

    // Generate DOCX buffer in memory
    const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' })

    // Convert DOCX buffer to PDF using LibreOffice
    let pdfBuffer
    try {
      pdfBuffer = await libreConvertAsync(docxBuffer, '.pdf', undefined)
    } catch (convErr) {
      console.error('LibreOffice conversion error:', convErr)
      return bad(res, 500, 'Failed to convert document to PDF')
    }

    // Prepare PDF response
    const outName = path.basename(templateName, path.extname(templateName)) + '-filled.pdf'
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`)
    return res.send(pdfBuffer)
  } catch (err) {
    console.error('POST /api/generate-document error:', err)
    return bad(res, 500, 'Internal error during document generation')
  }
})

export default app