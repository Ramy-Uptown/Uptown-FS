import express from 'express'
import { authMiddleware, requireRole } from './authRoutes.js'
import { pool } from './db.js'

const router = express.Router()
router.use(authMiddleware)

// Helper to read current thresholds row (latest by id)
async function readThresholds() {
  const q = await pool.query('SELECT * FROM payment_thresholds ORDER BY id DESC LIMIT 1')
  if (q.rows.length > 0) return q.rows[0]
  // If none, insert defaults and return
  const ins = await pool.query(
    `INSERT INTO payment_thresholds (
      first_year_percent_min, first_year_percent_max,
      second_year_percent_min, second_year_percent_max,
      handover_percent_min, handover_percent_max
    ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [10, null, 15, null, null, 5]
  )
  return ins.rows[0]
}

// Map DB row to API shape
function mapRow(row) {
  return {
    firstYearPercentMin: row.first_year_percent_min == null ? null : Number(row.first_year_percent_min),
    firstYearPercentMax: row.first_year_percent_max == null ? null : Number(row.first_year_percent_max),
    secondYearPercentMin: row.second_year_percent_min == null ? null : Number(row.second_year_percent_min),
    secondYearPercentMax: row.second_year_percent_max == null ? null : Number(row.second_year_percent_max),
    handoverPercentMin: row.handover_percent_min == null ? null : Number(row.handover_percent_min),
    handoverPercentMax: row.handover_percent_max == null ? null : Number(row.handover_percent_max),
  }
}

// Get payment thresholds (all roles can read)
router.get('/payment-thresholds', async (req, res) => {
  try {
    const row = await readThresholds()
    return res.json({ ok: true, thresholds: mapRow(row) })
  } catch (e) {
    console.error('GET /api/config/payment-thresholds error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Update payment thresholds (admin-only)
router.patch('/payment-thresholds', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const incoming = req.body || {}
    const current = await readThresholds()

    // Merge current with incoming (allow null to clear)
    const next = {
      first_year_percent_min: current.first_year_percent_min,
      first_year_percent_max: current.first_year_percent_max,
      second_year_percent_min: current.second_year_percent_min,
      second_year_percent_max: current.second_year_percent_max,
      handover_percent_min: current.handover_percent_min,
      handover_percent_max: current.handover_percent_max
    }

    const mapIn = {
      firstYearPercentMin: 'first_year_percent_min',
      firstYearPercentMax: 'first_year_percent_max',
      secondYearPercentMin: 'second_year_percent_min',
      secondYearPercentMax: 'second_year_percent_max',
      handoverPercentMin: 'handover_percent_min',
      handoverPercentMax: 'handover_percent_max'
    }

    for (const [apiKey, dbKey] of Object.entries(mapIn)) {
      if (Object.prototype.hasOwnProperty.call(incoming, apiKey)) {
        const v = incoming[apiKey]
        if (v === null || v === undefined || v === '') {
          next[dbKey] = null
        } else {
          const num = Number(v)
          if (!isFinite(num) || num < 0) {
            return res.status(400).json({ error: { message: `Invalid value for ${apiKey}` } })
          }
          next[dbKey] = num
        }
      }
    }

    const upd = await pool.query(
      `UPDATE payment_thresholds
       SET first_year_percent_min=$1,
           first_year_percent_max=$2,
           second_year_percent_min=$3,
           second_year_percent_max=$4,
           handover_percent_min=$5,
           handover_percent_max=$6
       WHERE id=$7
       RETURNING *`,
      [
        next.first_year_percent_min,
        next.first_year_percent_max,
        next.second_year_percent_min,
        next.second_year_percent_max,
        next.handover_percent_min,
        next.handover_percent_max,
        current.id
      ]
    )

    return res.json({ ok: true, thresholds: mapRow(upd.rows[0]) })
  } catch (e) {
    console.error('PATCH /api/config/payment-thresholds error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export default router