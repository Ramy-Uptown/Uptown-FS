import express from 'express'
import { authMiddleware, requireRole } from './authRoutes.js'

// Simple in-memory config store (can be replaced with DB-backed storage later)
const CONFIG = {
  paymentThresholds: {
    // Percent thresholds as fractions of total nominal
    // You can change these via the PATCH endpoint (admin only)
    firstYearPercentMin: 10,    // e.g., at least 10% in first year/down payment bucket
    firstYearPercentMax: null,  // optional
    secondYearPercentMin: 15,   // e.g., at least 15% in second year block
    secondYearPercentMax: null, // optional
    handoverPercentMin: null,   // optional
    handoverPercentMax: 5       // e.g., no more than 5% at handover
  }
}

const router = express.Router()
router.use(authMiddleware)

// Get payment thresholds (all roles can read)
router.get('/payment-thresholds', async (req, res) => {
  try {
    return res.json({ ok: true, thresholds: CONFIG.paymentThresholds })
  } catch (e) {
    console.error('GET /api/config/payment-thresholds error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Update payment thresholds (admin-only for now)
router.patch('/payment-thresholds', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const incoming = req.body || {}
    const t = CONFIG.paymentThresholds
    // Allow partial updates and nulls to clear
    const fields = [
      'firstYearPercentMin', 'firstYearPercentMax',
      'secondYearPercentMin', 'secondYearPercentMax',
      'handoverPercentMin', 'handoverPercentMax'
    ]
    for (const f of fields) {
      if (incoming.hasOwnProperty(f)) {
        const v = incoming[f]
        // Accept null to clear and finite numbers otherwise
        if (v === null || v === undefined || v === '') {
          t[f] = null
        } else {
          const num = Number(v)
          if (!isFinite(num) || num < 0) {
            return res.status(400).json({ error: { message: `Invalid value for ${f}` } })
          }
          t[f] = num
        }
      }
    }
    return res.json({ ok: true, thresholds: t })
  } catch (e) {
    console.error('PATCH /api/config/payment-thresholds error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export default router