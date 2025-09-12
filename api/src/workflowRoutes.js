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

/**
 * Sales team membership listing
 * Allows viewing existing manager assignments.
 * Optional query params:
 *  - consultant_user_id (number)
 *  - manager_user_id (number)
 *  - active (boolean, default true)
 */
router.get(
  '/sales-teams/memberships',
  authMiddleware,
  requireRole(['sales_manager', 'admin', 'superadmin', 'contract_manager', 'financial_manager']),
  async (req, res) => {
    try {
      const { consultant_user_id, manager_user_id } = req.query || {}
      const active = req.query.active === undefined ? true : String(req.query.active).toLowerCase() === 'true'
      const clauses = []
      const params = []

      if (consultant_user_id) {
        params.push(ensureNumber(consultant_user_id))
        clauses.push(`stm.consultant_user_id = ${params.length}`)
      }
      if (manager_user_id) {
        params.push(ensureNumber(manager_user_id))
        clauses.push(`stm.manager_user_id = ${params.length}`)
      }
      if (typeof active === 'boolean') {
        params.push(active)
        clauses.push(`stm.active = ${params.length}`)
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const sql = `
        SELECT stm.manager_user_id,
               stm.consultant_user_id,
               stm.active,
               m.email AS manager_email,
               c.email AS consultant_email
        FROM sales_team_members stm
        JOIN users m ON m.id = stm.manager_user_id
        JOIN users c ON c.id = stm.consultant_user_id
        ${where}
        ORDER BY stm.manager_user_id ASC, stm.consultant_user_id ASC
      `
      const r = await pool.query(sql, params)
      return ok(res, { memberships: r.rows })
    } catch (e) {
      console.error('GET /api/workflow/sales-teams/memberships error:', e)
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
          updates.push(`${f} = $${params.length}`)
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
      // Build update SQL using $ placeholders
      const updateSql = `
        UPDATE standard_pricing
        SET ${updates.join(', ')},
            status='pending_approval',
            approved_by=NULL,
            updated_at=now()
        WHERE id=$${params.length + 1}
        RETURNING *`
      const updateParams = params.concat([id])
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
  requireRole(['property_consultant', 'financial_manager', 'financial_admin', 'sales_manager']),
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
         WHERE id=$2 AND status IN ('pending_approval','pending_ceo_approval')
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

// Sales team assignments
router.post(
  '/sales-teams/assign',
  authMiddleware,
  requireRole(['sales_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, consultant_user_id } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const cid = ensureNumber(consultant_user_id)
      if (!mid || !cid) return bad(res, 400, 'manager_user_id and consultant_user_id are required numbers')
      const r = await pool.query(
        `INSERT INTO sales_team_members (manager_user_id, consultant_user_id, active)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (manager_user_id, consultant_user_id)
         DO UPDATE SET active=TRUE, updated_at=now()
         RETURNING *`,
        [mid, cid]
      )
      return ok(res, { membership: r.rows[0] })
    } catch (e) {
      console.error('POST /api/workflow/sales-teams/assign error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/sales-teams/assign',
  authMiddleware,
  requireRole(['sales_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, consultant_user_id, active } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const cid = ensureNumber(consultant_user_id)
      if (!mid || !cid || typeof active !== 'boolean') return bad(res, 400, 'manager_user_id, consultant_user_id and active:boolean are required')
      const r = await pool.query(
        `UPDATE sales_team_members SET active=$1, updated_at=now()
         WHERE manager_user_id=$2 AND consultant_user_id=$3
         RETURNING *`,
        [active, mid, cid]
      )
      if (r.rows.length === 0) return bad(res, 404, 'Assignment not found')
      return ok(res, { membership: r.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/sales-teams/assign error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Proposal listing helpers
router.get(
  '/payment-plans/my',
  authMiddleware,
  requireRole(['property_consultant']),
  async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM payment_plans WHERE created_by=$1 ORDER BY id DESC`,
        [req.user.id]
      )
      return ok(res, { payment_plans: r.rows })
    } catch (e) {
      console.error('GET /api/workflow/payment-plans/my error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.get(
  '/payment-plans/team',
  authMiddleware,
  requireRole(['sales_manager']),
  async (req, res) => {
    try {
      // consultants assigned to this manager
      const team = await pool.query(
        `SELECT consultant_user_id AS uid
         FROM sales_team_members
         WHERE manager_user_id=$1 AND active=TRUE`,
        [req.user.id]
      )
      const uids = team.rows.map(r => r.uid)
      if (uids.length === 0) return ok(res, { payment_plans: [] })
      const placeholders = uids.map((_, i) => `$${i + 1}`).join(',')
      const r = await pool.query(
        `SELECT * FROM payment_plans WHERE created_by IN (${placeholders}) ORDER BY id DESC`,
        uids
      )
      return ok(res, { payment_plans: r.rows })
    } catch (e) {
      console.error('GET /api/workflow/payment-plans/team error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Create a new version of a payment plan
router.post(
  '/payment-plans/:id/new-version',
  authMiddleware,
  requireRole(['property_consultant', 'financial_manager']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) {
        client.release()
        return bad(res, 400, 'Invalid id')
      }
      await client.query('BEGIN')
      const cur = await client.query('SELECT * FROM payment_plans WHERE id=$1', [id])
      if (cur.rows.length === 0) {
        await client.query('ROLLBACK'); client.release()
        return bad(res, 404, 'Payment plan not found')
      }
      const prev = cur.rows[0]
      // Next version number for same deal
      const vres = await client.query('SELECT COALESCE(MAX(version),0)+1 AS v FROM payment_plans WHERE deal_id=$1', [prev.deal_id])
      const nextV = vres.rows[0].v || 1
      const ins = await client.query(
        `INSERT INTO payment_plans (deal_id, details, created_by, status, version, supersedes_id)
         VALUES ($1, $2, $3, 'pending_approval', $4, $5)
         RETURNING *`,
        [prev.deal_id, prev.details, req.user.id, nextV, id]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { payment_plan: ins.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('POST /api/workflow/payment-plans/:id/new-version error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Mark an approved plan as accepted (unique per deal)
router.patch(
  '/payment-plans/:id/mark-accepted',
  authMiddleware,
  requireRole(['financial_manager', 'ceo']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) {
        client.release()
        return bad(res, 400, 'Invalid id')
      }
      await client.query('BEGIN')
      const cur = await client.query('SELECT id, deal_id, status FROM payment_plans WHERE id=$1', [id])
      if (cur.rows.length === 0) {
        await client.query('ROLLBACK'); client.release()
        return bad(res, 404, 'Not found')
      }
      if (cur.rows[0].status !== 'approved') {
        await client.query('ROLLBACK'); client.release()
        return bad(res, 400, 'Only approved plans can be accepted')
      }
      // Set accepted on this plan; unique index ensures only one per deal
      const upd = await client.query(
        `UPDATE payment_plans SET accepted=TRUE, accepted_at=now() WHERE id=$1 RETURNING *`,
        [id]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { payment_plan: upd.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      if (String(e.message || '').includes('uniq_payment_plans_one_accepted_per_deal')) {
        return bad(res, 400, 'This deal already has an accepted plan')
      }
      console.error('PATCH /api/workflow/payment-plans/:id/mark-accepted error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

/**
 * SECTION 3: Reservation Forms (Financial Admin -> Financial Manager review)
 * - create/edit by: financial_admin
 * - approve/reject by: financial_manager
 */
router.post(
  '/reservation-forms',
  authMiddleware,
  requireRole(['financial_admin']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const { payment_plan_id, details } = req.body || {}
      const pid = ensureNumber(payment_plan_id)
      if (!pid) {
        client.release()
        return bad(res, 400, 'payment_plan_id is required and must be a number')
      }

      // Ensure payment plan exists and is approved by financial manager
      const planRes = await client.query('SELECT id, status FROM payment_plans WHERE id=$1', [pid])
      if (planRes.rows.length === 0) { client.release(); return bad(res, 404, 'Payment plan not found') }
      if (planRes.rows[0].status !== 'approved') { client.release(); return bad(res, 400, 'Payment plan must be approved before creating reservation') }

      const det = details && typeof details === 'object' ? details : {}
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO reservation_forms (payment_plan_id, details, created_by, status)
         VALUES ($1, $2, $3, 'pending_approval')
         RETURNING *`,
        [pid, det, req.user.id]
      )
      const row = result.rows[0]
      await client.query(
        `INSERT INTO reservation_forms_history (reservation_form_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'create', $2, $3::jsonb, $4::jsonb)`,
        [row.id, req.user.id, JSON.stringify(null), JSON.stringify(row)]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { reservation_form: row })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('POST /api/workflow/reservation-forms error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Edit reservation form -> requires re-approval
router.patch(
  '/reservation-forms/:id',
  authMiddleware,
  requireRole(['financial_admin']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      const { details } = req.body || {}
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      const det = details && typeof details === 'object' ? details : {}
      await client.query('BEGIN')
      const prev = await client.query('SELECT * FROM reservation_forms WHERE id=$1', [id])
      if (prev.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found') }
      const upd = await client.query(
        `UPDATE reservation_forms
         SET details=$1, status='pending_approval', approved_by=NULL, updated_at=now()
         WHERE id=$2
         RETURNING *`,
        [det, id]
      )
      await client.query(
        `INSERT INTO reservation_forms_history (reservation_form_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'update', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(prev.rows[0]), JSON.stringify(upd.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { reservation_form: upd.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/reservation-forms/:id error:', e)
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
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      await client.query('BEGIN')
      const prev = await client.query('SELECT * FROM reservation_forms WHERE id=$1', [id])
      const result = await client.query(
        `UPDATE reservation_forms
         SET status='rejected', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status='pending_approval'
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found or not pending') }
      await client.query(
        `INSERT INTO reservation_forms_history (reservation_form_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'reject', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(prev.rows[0] || null), JSON.stringify(result.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { reservation_form: result.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/reservation-forms/:id/reject error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Reservation cancellation workflow
router.post(
  '/reservation-forms/:id/cancel-request',
  authMiddleware,
  requireRole(['financial_admin']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      await client.query('BEGIN')
      const cur = await client.query('SELECT * FROM reservation_forms WHERE id=$1', [id])
      if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found') }
      const upd = await client.query(
        `UPDATE reservation_forms SET status='pending_cancel_approval', updated_at=now() WHERE id=$1 RETURNING *`,
        [id]
      )
      await client.query(
        `INSERT INTO reservation_forms_history (reservation_form_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'cancel_request', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(cur.rows[0]), JSON.stringify(upd.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { reservation_form: upd.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('POST /api/workflow/reservation-forms/:id/cancel-request error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/reservation-forms/:id/cancel-approve',
  authMiddleware,
  requireRole(['financial_manager']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      await client.query('BEGIN')
      const cur = await client.query('SELECT * FROM reservation_forms WHERE id=$1', [id])
      if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found') }
      const upd = await client.query(
        `UPDATE reservation_forms SET status='cancelled', approved_by=$1, updated_at=now() WHERE id=$2 AND status='pending_cancel_approval' RETURNING *`,
        [req.user.id, id]
      )
      if (upd.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 400, 'Not pending cancellation approval') }
      await client.query(
        `INSERT INTO reservation_forms_history (reservation_form_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'cancel_approve', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(cur.rows[0]), JSON.stringify(upd.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { reservation_form: upd.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/reservation-forms/:id/cancel-approve error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

/**
 * SECTION 4: Contracts (Contract Person -> Contract Manager -> CEO approval)
 * - create/edit by: contract_person
 * - approve/reject by: contract_manager
 * - final approve: ceo
 */
router.post(
  '/contracts',
  authMiddleware,
  requireRole(['contract_person']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const { reservation_form_id, details } = req.body || {}
      const rid = ensureNumber(reservation_form_id)
      if (!rid) {
        client.release()
        return bad(res, 400, 'reservation_form_id is required and must be a number')
      }

      // Check reservation form
      const chk = await client.query('SELECT id, status FROM reservation_forms WHERE id=$1', [rid])
      if (chk.rows.length === 0) {
        client.release()
        return bad(res, 404, 'Reservation form not found')
      }
      if (chk.rows[0].status !== 'approved') {
        client.release()
        return bad(res, 400, 'Reservation must be approved before creating a contract')
      }

      const det = details && typeof details === 'object' ? details : {}
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO contracts (reservation_form_id, details, created_by, status)
         VALUES ($1, $2, $3, 'pending_approval')
         RETURNING *`,
        [rid, det, req.user.id]
      )
      const row = result.rows[0]
      await client.query(
        `INSERT INTO contracts_history (contract_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'create', $2, $3::jsonb, $4::jsonb)`,
        [row.id, req.user.id, JSON.stringify(null), JSON.stringify(row)]
      )
      await client.query('COMMIT')
      client.release()
      return ok(res, { contract: row })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('POST /api/workflow/contracts error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Edit contract -> requires re-approval
router.patch(
  '/contracts/:id',
  authMiddleware,
  requireRole(['contract_person']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      const { details } = req.body || {}
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      const det = details && typeof details === 'object' ? details : {}
      await client.query('BEGIN')
      const prev = await client.query('SELECT * FROM contracts WHERE id=$1', [id])
      if (prev.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found') }
      const upd = await client.query(
        `UPDATE contracts
         SET details=$1, status='pending_approval', approved_by=NULL, updated_at=now()
         WHERE id=$2
         RETURNING *`,
        [det, id]
      )
      await client.query(
        `INSERT INTO contracts_history (contract_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'update', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(prev.rows[0]), JSON.stringify(upd.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { contract: upd.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/contracts/:id error:', e)
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
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      await client.query('BEGIN')
      const prev = await client.query('SELECT * FROM contracts WHERE id=$1', [id])
      const result = await client.query(
        `UPDATE contracts
         SET status='pending_ceo_approval', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status='pending_approval'
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found or not pending') }
      await client.query(
        `INSERT INTO contracts_history (contract_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'approve_manager', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(prev.rows[0] || null), JSON.stringify(result.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { contract: result.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/contracts/:id/approve error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// CEO final approval for contracts
router.patch(
  '/contracts/:id/approve-ceo',
  authMiddleware,
  requireRole(['ceo']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      await client.query('BEGIN')
      const prev = await client.query('SELECT * FROM contracts WHERE id=$1', [id])
      const result = await client.query(
        `UPDATE contracts
         SET status='approved', updated_at=now()
         WHERE id=$1 AND status='pending_ceo_approval'
         RETURNING *`,
        [id]
      )
      if (result.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found or not pending CEO approval') }
      await client.query(
        `INSERT INTO contracts_history (contract_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'approve_ceo', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(prev.rows[0] || null), JSON.stringify(result.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { contract: result.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/contracts/:id/approve-ceo error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/contracts/:id/reject',
  authMiddleware,
  requireRole(['contract_manager']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      await client.query('BEGIN')
      const prev = await client.query('SELECT * FROM contracts WHERE id=$1', [id])
      const result = await client.query(
        `UPDATE contracts
         SET status='rejected', approved_by=$1, updated_at=now()
         WHERE id=$2 AND status IN ('pending_approval','pending_ceo_approval')
         RETURNING *`,
        [req.user.id, id]
      )
      if (result.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found or not pending') }
      await client.query(
        `INSERT INTO contracts_history (contract_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'reject', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(prev.rows[0] || null), JSON.stringify(result.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { contract: result.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/contracts/:id/reject error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// Contract cancellation workflow
router.post(
  '/contracts/:id/cancel-request',
  authMiddleware,
  requireRole(['contract_person']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      await client.query('BEGIN')
      const cur = await client.query('SELECT * FROM contracts WHERE id=$1', [id])
      if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found') }
      const upd = await client.query(
        `UPDATE contracts SET status='pending_cancel_manager_approval', updated_at=now() WHERE id=$1 RETURNING *`,
        [id]
      )
      await client.query(
        `INSERT INTO contracts_history (contract_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'cancel_request', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(cur.rows[0]), JSON.stringify(upd.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { contract: upd.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('POST /api/workflow/contracts/:id/cancel-request error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/contracts/:id/cancel-approve-manager',
  authMiddleware,
  requireRole(['contract_manager']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      await client.query('BEGIN')
      const cur = await client.query('SELECT * FROM contracts WHERE id=$1', [id])
      if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found') }
      const upd = await client.query(
        `UPDATE contracts SET status='pending_cancel_ceo_approval', updated_at=now() WHERE id=$1 AND status='pending_cancel_manager_approval' RETURNING *`,
        [id]
      )
      if (upd.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 400, 'Not pending manager cancellation approval') }
      await client.query(
        `INSERT INTO contracts_history (contract_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'cancel_approve_manager', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(cur.rows[0]), JSON.stringify(upd.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { contract: upd.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/contracts/:id/cancel-approve-manager error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/contracts/:id/cancel-approve-ceo',
  authMiddleware,
  requireRole(['ceo']),
  async (req, res) => {
    const client = await pool.connect()
    try {
      const id = ensureNumber(req.params.id)
      if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
      await client.query('BEGIN')
      const cur = await client.query('SELECT * FROM contracts WHERE id=$1', [id])
      if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Not found') }
      const upd = await client.query(
        `UPDATE contracts SET status='cancelled', updated_at=now() WHERE id=$1 AND status='pending_cancel_ceo_approval' RETURNING *`,
        [id]
      )
      if (upd.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 400, 'Not pending CEO cancellation approval') }
      await client.query(
        `INSERT INTO contracts_history (contract_id, change_type, changed_by, old_values, new_values)
         VALUES ($1, 'cancel_approve_ceo', $2, $3::jsonb, $4::jsonb)`,
        [id, req.user.id, JSON.stringify(cur.rows[0]), JSON.stringify(upd.rows[0])]
      )
      await client.query('COMMIT'); client.release()
      return ok(res, { contract: upd.rows[0] })
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      client.release()
      console.error('PATCH /api/workflow/contracts/:id/cancel-approve-ceo error:', e)
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