import express from 'express'
import cors from 'cors'
import {
  calculateByMode,
  CalculationModes,
  Frequencies
} from '../services/calculationService.js'

const app = express()
const PORT = process.env.PORT || 3000

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
function bad(res, code, message, details) {
  return res.status(code).json({
    error: { message, details },
    timestamp: new Date().toISOString()
  })
}

const allowedModes = new Set(Object.values(CalculationModes))
const allowedFrequencies = new Set(Object.values(Frequencies))

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
    // Frequency validation if provided
    if (inputs.installmentFrequency && !allowedFrequencies.has(inputs.installmentFrequency)) {
      return bad(res, 400, 'inputs.installmentFrequency is invalid', { allowedFrequencies: [...allowedFrequencies] })
    }

    const result = calculateByMode(mode, stdPlan, inputs)
    return res.json({ ok: true, data: result })
  } catch (err) {
    console.error('POST /api/calculate error:', err)
    return bad(res, 500, 'Internal error during calculation')
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${PORT}`)
})