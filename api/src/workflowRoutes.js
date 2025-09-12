import express from 'express'
import { pool } from './db.js'
import { authMiddleware, requireRole } from './authRoutes.js'

const router = express.Router()

// Utilities
function bad(res, code, message, details) {
  return res.status(code).json({ error: { message, details }, timestamp: new Date().toISOString() })
}
function ok(res, payload) {
  return res.json({ ok: true, ...payload })
}
function ensureNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * SECTION 1: Standard Pricing (Financial Manager -> CEO approval)
 * - create/update by: financial_manager
 * - approve/reject by: ceo
 */
router.post(
  '/standard-pricing',
  authMiddleware,
  requireRole(['financial_manager']),
  async (req, res) => {
    try {
      const {
        unit_id,
        unit_type,
        price,
        area,
        std_financial_rate_percent,
        plan_duration_years,
        installment_frequency
      } = req.body || {}

      const unitId = ensureNumber(unit_id)
      const pr = ensureNumber(price)
      const ar = ensureNumber(area)
      const rate = Number(std_financial_rate_percent)
      const years = Number(plan_duration_years)
      const freq = String(installment_frequency || '').toLowerCase()

      if (!unitId) return bad(res, 400, 'unit_id is required and must be a number')
      if (!unit_type || typeof unit_type !== 'string') return bad(res, 400, 'unit_type is required')
      if (pr == null || pr < 0) return bad(res, 400, 'price must be a non-negative number')
      if (ar == null || ar <= 0) return bad(res, 400, 'area must be a positive number')
      if (!isFinite(rate)) return bad(res, 400, 'std_financial_rate_percent must be a number')
      if (!Number.isInteger(years) || years <= 0) return bad(res, 400, 'plan_duration_years must be integer >= 1')
      const allowedFreq = new Set(['monthly', 'quarterly', 'bi-annually', 'annually'])
      if (!allowedFreq.has(freq)) return bad(res, 400, 'installment_frequency must be one of monthly|quarterly|bi-annually|annually')

      const result = await pool.query(
        `INSERT INTO standard_pricing
          (unit_id, unit_type, price, area, std_financial_rate_percent, plan_duration_years, installment_frequency, created_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_approval')
         RETURNING *`,
        [unitId, unit_type, pr, ar, rate, years, freq, req.user.id]
      )
      return ok(res, { standard_pricing: result.rows[0] })
    } catch (e) {
      console.error('POST /api/workflow/standard-pricing error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.get(
  '/standard-pricing',
  authMiddleware,
  requireRole(['financial_manager', 'ceo', 'admin', 'superadmin', 'property_consultant', 'financial_admin', 'contract_person', 'contract_manager']),
  async (req, res) => {
    try {
      const { unit_id, status } = req.query || {}
      const unitId = unit_id ? ensureNumber(unit_id) : null
      const clauses = []
      const params = []
      if (unitId) {
        params.push(unitId)
        clauses.push(`unit_id = ${params.length}`)
      }
      if (status) {
        params.push(String(status))
        clauses.push(`status = ${params.length}`)
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const q = `SELECT * FROM standard_pricing ${where} ORDER BY id DESC`
      const result = await pool.query(q, params)
      return ok(res, { standard_pricing: result.rows })
    } catch (e) {
      console.error('GET /api/workflow/standard-pricing error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Financial manager updates standard data (even if approved) -> moves to pending_approval and logs history
router.patch(
  '/standard-pricing/:id',
  authMiddleware,
  requireRole(['financial_manager']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')

      // Load old row
      const oldRes = await client.query('SELECT * FROM standard_pricing WHERE id=$1', [id])
      if (oldRes.rows.length === 0) {
        client.release()
        return bad(res, 404, 'Standard record not found')
      }
      const oldRow = oldRes.rows[0]

      const allowedFields = [
        'unit_type', 'price', 'area', 'std_financial_rate_percent',
        'plan_duration_years', 'installment_frequency'
      ]
      const updates = []
      const params = []
      for (const f of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, f)) {
          params.push(req.body[f])
          updates.push(`${f} = ${params.length}`)
        }
      }
      if (updates.length === 0) {
        client.release()
        return bad(res, 400, 'No updatable fields provided')
      }

      // Enforce valid frequency if provided
      if (Object.prototype.hasOwnProperty.call(req.body, 'installment_frequency')) {
        const freq = String(req.body.installment_frequency || '').toLowerCase()
        const allowed = new Set(['monthly', 'quarterly', 'bi-annually', 'annually'])
        if (!allowed.has(freq)) {
          client.release()
          return bad(res, 400, 'installment_frequency must be one of monthly|quarterly|bi-annually|annually')
        }
      }

      await client.query('BEGIN')
      // Set to pending_approval on any edit and clear approval
      params.push(req.user.id) // param for history insert
      params.push(id)
      const updateSql = `
        UPDATE standard_pricing
        SET ${updates.join(', ')},
            status='pending_approval',
            approved_by=NULL,
            updated_at=now()
        WHERE id=${params.length}
        RETURNING *`
      // Note: params layout: [field values..., req.user.id, id]; req.user.id is not used in SQL but kept for order; using index accordingly
      // Execute update (ignoring the extra param for user id in update)
      // Rebuild params to avoid confusion:
      const updateParams = params.slice(0, updates.length).concat([id])
      const updRes = await client.query(updateSql, updateParams)
      const newRow = updRes.rows[0]

      // History log
      await client.query(
        `INSERT INTO standard_pricing_history
         (standard_pricing_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'update', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(oldRow), JSON.stringify(newRow)]
      )

      await client.query('COMMIT')
      client.release()
      return ok(res, { standard_pricing: newRow })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/standard-pricing/:id error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// CEO approves/rejects
router.patch(
  '/standard-pricing/:id/approve',
  authMiddleware,
  requireRole(['ceo']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) {
        client.release()
        return bad(res, 400, 'Invalid id')
      }
      await client.query('BEGIN')
      const prev = await client.query('SELECT * FROM standard_pricing WHERE id=$1', [id])
      const result = await client.query(
        `UPDATE standard_pricing
         SET status='approved', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status='pending_approval'
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        client.release()
        return bad(res, 404, 'Not found or not pending')
      }
      const row = result.rows[0]
      await client.query(
        `INSERT INTO standard_pricing_history
         (standard_pricing_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'approve', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(prev.rows[0] || null), JSON.stringify(row)]
      )
      await client.query('COMMIT')
      client.release()
      return ok(res, { standard_pricing: row })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/standard-pricing/:id/approve error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/standard-pricing/:id/reject',
  authMiddleware,
  requireRole(['ceo']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) {
        client.release()
        return bad(res, 400, 'Invalid id')
      }
      await client.query('BEGIN')
      const prev = await client.query('SELECT * FROM standard_pricing WHERE id=$1', [id])
      const result = await client.query(
        `UPDATE standard_pricing
         SET status='rejected', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status='pending_approval'
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        client.release()
        return bad(res, 404, 'Not found or not pending')
      }
      const row = result.rows[0]
      await client.query(
        `INSERT INTO standard_pricing_history
         (standard_pricing_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'reject', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(prev.rows[0] || null), JSON.stringify(row)]
      )
      await client.query('COMMIT')
      client.release()
      return ok(res, { standard_pricing: row })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/standard-pricing/:id/reject error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

/**
 * SECTION 2: Payment Plans (Sales Consultant -> Financial Manager approval)
 * - create by: property_consultant
 * - approve/reject by: financial_manager
 */
router.post(
  '/payment-plans',
  authMiddleware,
  requireRole(['property_consultant', 'financial_manager']),
  async (req, res) => {
    try {
      const { deal_id, details } = req.body || {}
      const dealId = ensureNumber(deal_id)
      if (!dealId) return bad(res, 400, 'deal_id is required and must be a number')
      const det = details && typeof details === 'object' ? details : {}

      // Extract discount percent from typical shapes
      const disc = Number(det?.inputs?.salesDiscountPercent ?? det?.salesDiscountPercent ?? 0) || 0
      let status = 'pending_approval'
      if (req.user?.role === 'property_consultant') {
        if (disc > 2) return bad(res, 400, 'Sales consultants can apply a maximum discount of 2%')
      } else if (req.user?.role === 'financial_manager') {
        if (disc > 5) return bad(res, 400, 'Financial managers can apply a maximum discount of 5%')
        if (disc > 2) status = 'pending_ceo_approval'
      }

      const result = await pool.query(
        `INSERT INTO payment_plans (deal_id, details, created_by, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [dealId, det, req.user.id, status]
      )
      return ok(res, { payment_plan: result.rows[0] })
    } catch (e) {
      console.error('POST /api/workflow/payment-plans error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.get(
  '/payment-plans',
  authMiddleware,
  requireRole(['property_consultant', 'financial_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const { deal_id, status } = req.query || {}
      const clauses = []
      const params = []
      if (deal_id) {
        params.push(ensureNumber(deal_id))
        clauses.push(`deal_id = $${params.length}`)
      }
      if (status) {
        params.push(String(status))
        clauses.push(`status = $${params.length}`)
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const result = await pool.query(`SELECT * FROM payment_plans ${where} ORDER BY id DESC`, params)
      return ok(res, { payment_plans: result.rows })
    } catch (e) {
      console.error('GET /api/workflow/payment-plans error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Approvals by financial_manager
router.patch(
  '/payment-plans/:id/approve',
  authMiddleware,
  requireRole(['financial_manager']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')

      // Load plan to check discount and current status
      const cur = await pool.query('SELECT id, details, status FROM payment_plans WHERE id=$1', [id])
      if (cur.rows.length === 0) return bad(res, 404, 'Not found')
      if (cur.rows[0].status !== 'pending_approval') return bad(res, 400, 'Plan not in pending_approval state')

      const det = cur.rows[0].details || {}
      const disc = Number(det?.inputs?.salesDiscountPercent ?? det?.salesDiscountPercent ?? 0) || 0

      if (disc > 2) {
        // Move to CEO queue
        const result = await pool.query(
          `UPDATE payment_plans
           SET status='pending_ceo_approval', approved_by=$1, updated_at=now()
           WHERE id=$2
           RETURNING *`,
          [req.user.id, id]
        )
        return ok(res, { payment_plan: result.rows[0] })
      } else {
        const result = await pool.query(
          `UPDATE payment_plans
           SET status='approved', approved_by=$1, updated_at=now()
           WHERE id=$2
           RETURNING *`,
          [req.user.id, id]
        )
        return ok(res, { payment_plan: result.rows[0] })
      }
    } catch (e) {
      console.error('PATCH /api/workflow/payment-plans/:id/approve error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/payment-plans/:id/reject',
  authMiddleware,
  requireRole(['financial_manager']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')
      const result = await pool.query(
        `UPDATE payment_plans
         SET status='rejected', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status IN ('pending_approval', 'pending_ceo_approval')
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) return bad(res, 404, 'Not found or not pending')
      return ok(res, { payment_plan: result.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/payment-plans/:id/reject error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// CEO approval for plans that exceeded 2% discount
router.patch(
  '/payment-plans/:id/approve-ceo',
  authMiddleware,
  requireRole(['ceo']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')
      const result = await pool.query(
        `UPDATE payment_plans
         SET status='approved', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status='pending_ceo_approval'
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) return bad(res, 404, 'Not found or not pending CEO approval')
      return ok(res, { payment_plan: result.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/payment-plans/:id/approve-ceo error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

/**
 * SECTION 3: Reservation Forms (Financial Admin -> Financial Manager review)
 * - create by: financial_admin
 * - approve/reject by: financial_manager
 */
router.post(
  '/reservation-forms',
  authMiddleware,
  requireRole(['financial_admin']),
  async (req, res) => {
    try {
      const { payment_plan_id, details } = req.body || {}
      const pid = ensureNumber(payment_plan_id)
      if (!pid) return bad(res, 400, 'payment_plan_id is required and must be a number')

      // Ensure payment plan exists and is approved by financial manager
      const planRes = await pool.query('SELECT id, status FROM payment_plans WHERE id=$1', [pid])
      if (planRes.rows.length === 0) return bad(res, 404, 'Payment plan not found')
      if (planRes.rows[0].status !== 'approved') return bad(res, 400, 'Payment plan must be approved before creating reservation')

      const det = details && typeof details === 'object' ? details : {}
      const result = await pool.query(
        `INSERT INTO reservation_forms (payment_plan_id, details, created_by, status)
         VALUES ($1, $2, $3, 'pending_approval')
         RETURNING *`,
        [pid, det, req.user.id]
      )
      return ok(res, { reservation_form: result.rows[0] })
    } catch (e) {
      console.error('POST /api/workflow/reservation-forms error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.get(
  '/reservation-forms',
  authMiddleware,
  requireRole(['financial_admin', 'financial_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const { payment_plan_id, status } = req.query || {}
      const clauses = []
      const params = []
      if (payment_plan_id) {
        params.push(ensureNumber(payment_plan_id))
        clauses.push(`payment_plan_id = $${params.length}`)
      }
      if (status) {
        params.push(String(status))
        clauses.push(`status = $${params.length}`)
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const result = await pool.query(`SELECT * FROM reservation_forms ${where} ORDER BY id DESC`, params)
      return ok(res, { reservation_forms: result.rows })
    } catch (e) {
      console.error('GET /api/workflow/reservation-forms error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/reservation-forms/:id/approve',
  authMiddleware,
  requireRole(['financial_manager']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')
      const result = await pool.query(
        `UPDATE reservation_forms
         SET status='approved', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status='pending_approval'
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) return bad(res, 404, 'Not found or not pending')
      return ok(res, { reservation_form: result.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/reservation-forms/:id/approve error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/reservation-forms/:id/reject',
  authMiddleware,
  requireRole(['financial_manager']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')
      const result = await pool.query(
        `UPDATE reservation_forms
         SET status='rejected', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status='pending_approval'
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) return bad(res, 404, 'Not found or not pending')
      return ok(res, { reservation_form: result.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/reservation-forms/:id/reject error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

/**
 * SECTION 4: Contracts (Contract Person -> Contract Manager review)
 * - create by: contract_person
 * - approve/reject by: contract_manager
 */
router.post(
  '/contracts',
  authMiddleware,
  requireRole(['contract_person']),
  async (req, res) => {
    try {
      const { reservation_form_id, details } = req.body || {}
      const rid = ensureNumber(reservation_form_id)
      if (!rid) return bad(res, 400, 'reservation_form_id is required and must be a number')
      const det = details && typeof details === 'object' ? details : {}
      const result = await pool.query(
        `INSERT INTO contracts (reservation_form_id, details, created_by, status)
         VALUES ($1, $2, $3, 'pending_approval')
         RETURNING *`,
        [rid, det, req.user.id]
      )
      return ok(res, { contract: result.rows[0] })
    } catch (e) {
      console.error('POST /api/workflow/contracts error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.get(
  '/contracts',
  authMiddleware,
  requireRole(['contract_person', 'contract_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const { reservation_form_id, status } = req.query || {}
      const clauses = []
      const params = []
      if (reservation_form_id) {
        params.push(ensureNumber(reservation_form_id))
        clauses.push(`reservation_form_id = $${params.length}`)
      }
      if (status) {
        params.push(String(status))
        clauses.push(`status = $${params.length}`)
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const result = await pool.query(`SELECT * FROM contracts ${where} ORDER BY id DESC`, params)
      return ok(res, { contracts: result.rows })
    } catch (e) {
      console.error('GET /api/workflow/contracts error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/contracts/:id/approve',
  authMiddleware,
  requireRole(['contract_manager']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')
      const result = await pool.query(
        `UPDATE contracts
         SET status='approved', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status='pending_approval'
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) return bad(res, 404, 'Not found or not pending')
      return ok(res, { contract: result.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/contracts/:id/approve error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/contracts/:id/reject',
  authMiddleware,
  requireRole(['contract_manager']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')
      const result = await pool.query(
        `UPDATE contracts
         SET status='rejected', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status='pending_approval'
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) return bad(res, 404, 'Not found or not pending')
      return ok(res, { contract: result.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/contracts/:id/reject error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Simple read-only endpoint: fetch approved standard for a unit in one call
router.get(
  '/standard-pricing/approved-by-unit/:unitId',
  authMiddleware,
  requireRole(['property_consultant', 'financial_admin', 'contract_person', 'contract_manager', 'financial_manager', 'ceo', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const unitId = Number(req.params.unitId)
      if (!Number.isFinite(unitId)) return bad(res, 400, 'Invalid unitId')

      const r = await pool.query(
        `SELECT *
         FROM standard_pricing
         WHERE unit_id = $1 AND status = 'approved'
         ORDER BY id DESC
         LIMIT 1`,
        [unitId]
      )
      if (r.rows.length === 0) {
        return bad(res, 404, 'No approved standard found for this unit')
      }
      return ok(res, { standard_pricing: r.rows[0] })
    } catch (e) {
      console.error('GET /api/workflow/standard-pricing/approved-by-unit/:unitId error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Simple read-only endpoint: fetch approved standard by unit type in one call
router.get(
  '/standard-pricing/approved-by-type/:unitType',
  authMiddleware,
  requireRole(['property_consultant', 'financial_admin', 'contract_person', 'contract_manager', 'financial_manager', 'ceo', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const unitType = String(req.params.unitType || '').trim()
      if (!unitType) return bad(res, 400, 'Invalid unitType')

      const r = await pool.query(
        `SELECT *
         FROM standard_pricing
         WHERE unit_type ILIKE $1 AND status='approved'
         ORDER BY id DESC
         LIMIT 1`,
        [unitType]
      )
      if (r.rows.length === 0) {
        return bad(res, 404, 'No approved standard found for this type')
      }
      return ok(res, { standard_pricing: r.rows[0] })
    } catch (e) {
      console.error('GET /api/workflow/standard-pricing/approved-by-type/:unitType error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

export default router