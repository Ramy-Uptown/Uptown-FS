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

/**
 * Acceptance thresholds (expanded) — dynamic TM-approved values
 * This endpoint returns a superset including third-year and PV tolerance values.
 * For backwards compatibility with existing payment_thresholds schema, we derive sensible defaults if fields are absent.
 */
router.get('/acceptance-thresholds', async (req, res) => {
  try {
    const row = await readThresholds()

    // Base from existing table
    const base = mapRow(row)

    // Derived defaults to mirror ver6.2 if not yet configured in DB
    const thirdYearPercentMin = 65
    const thirdYearPercentMax = null
    const pvTolerancePercent = 100 // 100% => Proposed PV must be >= Standard PV (no relaxation)

    return res.json({
      ok: true,
      thresholds: {
        ...base,
        thirdYearPercentMin,
        thirdYearPercentMax,
        pvTolerancePercent
      }
    })
  } catch (e) {
    console.error('GET /api/config/acceptance-thresholds error:', e)
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

/**
 * Proposals workflow
 */

// List proposals (FM sees own pending; TM sees all pending)
router.get('/payment-thresholds/proposals', async (req, res) => {
  try {
    const user = req.user
    const role = user?.role
    let rows = []
    if (role === 'financial_manager') {
      const q = await pool.query('SELECT * FROM payment_threshold_proposals WHERE status=$1 AND proposed_by=$2 ORDER BY proposed_at DESC', ['pending', user.id])
      rows = q.rows
    } else if (['ceo', 'chairman', 'vice_chairman', 'top_management'].includes(role)) {
      const q = await pool.query('SELECT * FROM payment_threshold_proposals WHERE status=$1 ORDER BY proposed_at ASC', ['pending'])
      rows = q.rows
    } else {
      return res.status(403).json({ error: { message: 'Forbidden' } })
    }
    return res.json({
      ok: true,
      proposals: rows.map(r => ({
        id: r.id,
        status: r.status,
        proposed_by: r.proposed_by,
        proposed_at: r.proposed_at,
        approved_by: r.approved_by,
        approved_at: r.approved_at,
        approval_notes: r.approval_notes,
        thresholds: {
          firstYearPercentMin: r.first_year_percent_min == null ? null : Number(r.first_year_percent_min),
          firstYearPercentMax: r.first_year_percent_max == null ? null : Number(r.first_year_percent_max),
          secondYearPercentMin: r.second_year_percent_min == null ? null : Number(r.second_year_percent_min),
          secondYearPercentMax: r.second_year_percent_max == null ? null : Number(r.second_year_percent_max),
          handoverPercentMin: r.handover_percent_min == null ? null : Number(r.handover_percent_min),
          handoverPercentMax: r.handover_percent_max == null ? null : Number(r.handover_percent_max),
        }
      }))
    })
  } catch (e) {
    console.error('GET /api/config/payment-thresholds/proposals error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Create proposal (FM only)
router.post('/payment-thresholds/proposals', requireRole(['financial_manager']), async (req, res) => {
  try {
    const user = req.user
    const inc = req.body || {}
    const fields = [
      'firstYearPercentMin', 'firstYearPercentMax',
      'secondYearPercentMin', 'secondYearPercentMax',
      'handoverPercentMin', 'handoverPercentMax'
    ]
    const vals = {}
    for (const f of fields) {
      const v = inc[f]
      if (v === null || v === undefined || v === '') {
        vals[f] = null
      } else {
        const num = Number(v)
        if (!isFinite(num) || num < 0) {
          return res.status(400).json({ error: { message: `Invalid value for ${f}` } })
        }
        vals[f] = num
      }
    }
    const ins = await pool.query(
      `INSERT INTO payment_threshold_proposals (
        first_year_percent_min, first_year_percent_max,
        second_year_percent_min, second_year_percent_max,
        handover_percent_min, handover_percent_max,
        status, proposed_by
      ) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING *`,
      [
        vals.firstYearPercentMin,
        vals.firstYearPercentMax,
        vals.secondYearPercentMin,
        vals.secondYearPercentMax,
        vals.handoverPercentMin,
        vals.handoverPercentMax,
        user.id
      ]
    )
    return res.json({ ok: true, proposal_id: ins.rows[0].id })
  } catch (e) {
    console.error('POST /api/config/payment-thresholds/proposals error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Approve proposal (TM only) -> apply to active thresholds
router.post('/payment-thresholds/proposals/:id/approve', requireRole(['ceo', 'chairman', 'vice_chairman', 'top_management']), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const approver = req.user?.id
    const notes = req.body?.notes || null

    const q = await pool.query('SELECT * FROM payment_threshold_proposals WHERE id=$1', [id])
    const r = q.rows[0]
    if (!r) return res.status(404).json({ error: { message: 'Proposal not found' } })
    if (r.status !== 'pending') return res.status(400).json({ error: { message: 'Proposal is not pending' } })

    // Update active thresholds by inserting a new row to maintain history
    const insActive = await pool.query(
      `INSERT INTO payment_thresholds (
        first_year_percent_min, first_year_percent_max,
        second_year_percent_min, second_year_percent_max,
        handover_percent_min, handover_percent_max
      ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        r.first_year_percent_min,
        r.first_year_percent_max,
        r.second_year_percent_min,
        r.second_year_percent_max,
        r.handover_percent_min,
        r.handover_percent_max
      ]
    )

    await pool.query(
      `UPDATE payment_threshold_proposals
       SET status='approved', approved_by=$1, approved_at=now(), approval_notes=$2
       WHERE id=$3`,
      [approver, notes, id]
    )

    return res.json({ ok: true, thresholds: mapRow(insActive.rows[0]) })
  } catch (e) {
    console.error('POST /api/config/payment-thresholds/proposals/:id/approve error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Reject proposal (TM only)
router.post('/payment-thresholds/proposals/:id/reject', requireRole(['ceo', 'chairman', 'vice_chairman', 'top_management']), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const approver = req.user?.id
    const notes = req.body?.notes || null

    const q = await pool.query('SELECT * FROM payment_threshold_proposals WHERE id=$1', [id])
    const r = q.rows[0]
    if (!r) return res.status(404).json({ error: { message: 'Proposal not found' } })
    if (r.status !== 'pending') return res.status(400).json({ error: { message: 'Proposal is not pending' } })

    await pool.query(
      `UPDATE payment_threshold_proposals
       SET status='rejected', approved_by=$1, approved_at=now(), approval_notes=$2
       WHERE id=$3`,
      [approver, notes, id]
    )

    return res.json({ ok: true })
  } catch (e) {
    console.error('POST /api/config/payment-thresholds/proposals/:id/reject error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export default router