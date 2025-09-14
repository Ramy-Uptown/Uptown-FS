import express from 'express'
import { pool } from './db.js'
import { authMiddleware, requireRole } from './authRoutes.js'

const router = express.Router()

function bad(res, code, message, details) {
  return res.status(code).json({ error: { message, details }, timestamp: new Date().toISOString() })
}
function ok(res, payload) { return res.json({ ok: true, ...payload }) }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null }

//
// Unit Types (financial_manager only)
//
router.post('/types', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  try {
    const { name, description } = req.body || {}
    if (!name || typeof name !== 'string') return bad(res, 400, 'name is required')
    const r = await pool.query(
      'INSERT INTO unit_types (name, description, active) VALUES ($1,$2,TRUE) RETURNING *',
      [name.trim(), description || null]
    )
    return ok(res, { unit_type: r.rows[0] })
  } catch (e) {
    if (String(e.message || '').includes('unique')) return bad(res, 409, 'Type name already exists')
    console.error('POST /api/inventory/types error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.get('/types', authMiddleware, requireRole(['financial_manager', 'property_consultant', 'sales_manager', 'financial_admin', 'admin', 'superadmin']), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM unit_types WHERE active=TRUE ORDER BY name ASC')
    return ok(res, { unit_types: r.rows })
  } catch (e) {
    console.error('GET /api/inventory/types error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.patch('/types/:id', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  try {
    const id = num(req.params.id)
    if (!id) return bad(res, 400, 'Invalid id')
    const { name, description, active } = req.body || {}
    const fields = []
    const params = []
    if (name != null) { params.push(String(name)); fields.push(`name=${params.length}`) }
    if (description !== undefined) { params.push(description === null ? null : String(description)); fields.push(`description=${params.length}`) }
    if (typeof active === 'boolean') { params.push(active); fields.push(`active=${params.length}`) }
    if (fields.length === 0) return bad(res, 400, 'No fields to update')
    params.push(id)
    const r = await pool.query(`UPDATE unit_types SET ${fields.join(', ')}, updated_at=now() WHERE id=${params.length} RETURNING *`, params)
    if (r.rows.length === 0) return bad(res, 404, 'Not found')
    return ok(res, { unit_type: r.rows[0] })
  } catch (e) {
    console.error('PATCH /api/inventory/types/:id error:', e)
    return bad(res, 500, 'Internal error')
  }
})

//
// Per-type pricing (financial_manager -> CEO approve? keeping similar to standard_pricing approvals by CEO)
//
router.post('/types/:id/pricing', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  try {
    const typeId = num(req.params.id)
    if (!typeId) return bad(res, 400, 'Invalid unit type id')
    const {
      base_price, garden_price, maintenance_price, roof_price, additional_price
    } = req.body || {}
    const r = await pool.query(
      `INSERT INTO unit_type_pricing
       (unit_type_id, base_price, garden_price, maintenance_price, roof_price, additional_price, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending_approval') RETURNING *`,
      [typeId, Number(base_price)||0, garden_price==null?null:Number(garden_price),
       Number(maintenance_price)||0, roof_price==null?null:Number(roof_price),
       additional_price==null?null:Number(additional_price), req.user.id]
    )
    return ok(res, { pricing: r.rows[0] })
  } catch (e) {
    console.error('POST /api/inventory/types/:id/pricing error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.get('/types/:id/pricing', authMiddleware, requireRole(['financial_manager','property_consultant','sales_manager','financial_admin','admin','superadmin']), async (req, res) => {
  try {
    const typeId = num(req.params.id)
    if (!typeId) return bad(res, 400, 'Invalid unit type id')
    const r = await pool.query(
      `SELECT * FROM unit_type_pricing WHERE unit_type_id=$1 AND status='approved' ORDER BY id DESC LIMIT 1`,
      [typeId]
    )
    if (r.rows.length === 0) return bad(res, 404, 'No approved pricing for this type')
    return ok(res, { pricing: r.rows[0] })
  } catch (e) {
    console.error('GET /api/inventory/types/:id/pricing error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.patch('/types/pricing/:pricingId/approve', authMiddleware, requireRole(['ceo']), async (req, res) => {
  try {
    const id = num(req.params.pricingId)
    if (!id) return bad(res, 400, 'Invalid id')
    const r = await pool.query(
      `UPDATE unit_type_pricing SET status='approved', approved_by=$1, updated_at=now() WHERE id=$2 AND status='pending_approval' RETURNING *`,
      [req.user.id, id]
    )
    if (r.rows.length === 0) return bad(res, 404, 'Not found or not pending')
    return ok(res, { pricing: r.rows[0] })
  } catch (e) {
    console.error('PATCH /api/inventory/types/pricing/:pricingId/approve error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.patch('/types/pricing/:pricingId/reject', authMiddleware, requireRole(['ceo']), async (req, res) => {
  try {
    const id = num(req.params.pricingId)
    if (!id) return bad(res, 400, 'Invalid id')
    const r = await pool.query(
      `UPDATE unit_type_pricing SET status='rejected', approved_by=$1, updated_at=now() WHERE id=$2 AND status='pending_approval' RETURNING *`,
      [req.user.id, id]
    )
    if (r.rows.length === 0) return bad(res, 404, 'Not found or not pending')
    return ok(res, { pricing: r.rows[0] })
  } catch (e) {
    console.error('PATCH /api/inventory/types/pricing/:pricingId/reject error:', e)
    return bad(res, 500, 'Internal error')
  }
})

//
// Inventory (finance-admin adds drafts; financial_manager reviews; readers broader)
//

// Finance-Admin: Add new unit as draft
router.post('/units/draft', authMiddleware, requireRole(['financial_admin']), async (req, res) => {
  try {
    const {
      project_name, building, floor_number, unit_number, area_sqft, unit_type_id,
      view_description, orientation, special_features, description
    } = req.body || {}

    if (!project_name) return bad(res, 400, 'project_name is required')
    if (!unit_number) return bad(res, 400, 'unit_number is required')
    if (!area_sqft) return bad(res, 400, 'area_sqft is required')
    if (!unit_type_id) return bad(res, 400, 'unit_type_id is required')

    // Generate code unique within project (simple concat)
    const code = `${String(project_name).trim()}-${String(unit_number).trim()}`

    // Ensure uniqueness by code
    const exists = await pool.query('SELECT 1 FROM units WHERE code=$1', [code])
    if (exists.rows.length > 0) return bad(res, 409, 'Unit already exists for this project/unit number')

    const meta = {
      project_name, building, floor_number, unit_number, area_sqft,
      view_description: view_description || null,
      orientation: orientation || null,
      special_features: special_features || null
    }

    const r = await pool.query(
      `INSERT INTO units (code, description, unit_type_id, unit_type, base_price, currency, created_by, unit_status, available, meta)
       VALUES ($1, $2, $3, NULL, 0, 'EGP', $4, 'INVENTORY_DRAFT', FALSE, $5::jsonb)
       RETURNING *`,
      [code, description || null, num(unit_type_id), req.user.id, JSON.stringify(meta)]
    )
    return ok(res, { unit: r.rows[0] })
  } catch (e) {
    console.error('POST /api/inventory/units/draft error:', e)
    return bad(res, 500, 'Internal error')
  }
})

// Finance-Manager: list drafts to review
router.get('/units/drafts', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM units WHERE unit_status='INVENTORY_DRAFT' ORDER BY created_at DESC`
    )
    return ok(res, { units: r.rows })
  } catch (e) {
    console.error('GET /api/inventory/units/drafts error:', e)
    return bad(res, 500, 'Internal error')
  }
})

// Finance-Manager: approve or reject draft
router.patch('/units/:id/review', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  try {
    const id = num(req.params.id)
    const { action, reason, standard_price, min_down_payment_percent, min_down_payment_amount, default_interest_rate, discount_policy_limit, target_npv_tolerance } = req.body || {}
    if (!id) return bad(res, 400, 'Invalid id')
    if (!['approve', 'reject'].includes(String(action))) return bad(res, 400, 'action must be approve|reject')

    const curr = await pool.query('SELECT * FROM units WHERE id=$1', [id])
    if (curr.rows.length === 0) return bad(res, 404, 'Unit not found')
    if (curr.rows[0].unit_status !== 'INVENTORY_DRAFT') return bad(res, 400, 'Unit is not in draft')

    if (action === 'approve') {
      // Approve -> Available
      const r = await pool.query(
        `UPDATE units SET unit_status='AVAILABLE', approved_by=$1, available=TRUE, updated_at=now() WHERE id=$2 RETURNING *`,
        [req.user.id, id]
      )
      return ok(res, { unit: r.rows[0] })
    } else {
      // Reject -> INVENTORY_REJECTED; reason stored in meta.history
      const metaUpdate = await pool.query('SELECT meta FROM units WHERE id=$1', [id])
      const meta = metaUpdate.rows[0]?.meta || {}
      const history = Array.isArray(meta.history) ? meta.history : []
      history.push({ t: new Date().toISOString(), by: req.user.id, action: 'reject', reason: reason || null })
      meta.history = history
      const r = await pool.query(
        `UPDATE units SET unit_status='INVENTORY_REJECTED', approved_by=$1, available=FALSE, meta=$2::jsonb, updated_at=now() WHERE id=$3 RETURNING *`,
        [req.user.id, JSON.stringify(meta), id]
      )
      return ok(res, { unit: r.rows[0] })
    }
  } catch (e) {
    console.error('PATCH /api/inventory/units/:id/review error:', e)
    return bad(res, 500, 'Internal error')
  }
})

// Existing: FM can patch unit linking to type or availability
router.patch('/units/:id', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  try {
    const id = num(req.params.id)
    if (!id) return bad(res, 400, 'Invalid unit id')
    const { unit_type_id, available } = req.body || {}
    const fields = []
    const params = []
    if (unit_type_id != null) { params.push(num(unit_type_id)); fields.push(`unit_type_id=${params.length}`) }
    if (typeof available === 'boolean') { params.push(available); fields.push(`available=${params.length}`) }
    if (fields.length === 0) return bad(res, 400, 'No fields to update')
    params.push(id)
    const r = await pool.query(`UPDATE units SET ${fields.join(', ')}, updated_at=now() WHERE id=${params.length} RETURNING *`, params)
    if (r.rows.length === 0) return bad(res, 404, 'Unit not found')
    return ok(res, { unit: r.rows[0] })
  } catch (e) {
    console.error('PATCH /api/inventory/units/:id error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.get('/units', authMiddleware, requireRole(['financial_manager','property_consultant','sales_manager','financial_admin','admin','superadmin']), async (req, res) => {
  try {
    const { unit_type_id } = req.query || {}
    const clauses = ['available=TRUE']
    const params = []
    if (unit_type_id) { params.push(num(unit_type_id)); clauses.push(`unit_type_id=${params.length}`) }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const r = await pool.query(`SELECT id, code, description, unit_type_id, unit_type, base_price, currency FROM units ${where} ORDER BY code ASC`, params)
    return ok(res, { units: r.rows })
  } catch (e) {
    console.error('GET /api/inventory/units error:', e)
    return bad(res, 500, 'Internal error')
  }
})

// Hold requests
router.post('/holds', authMiddleware, requireRole(['property_consultant']), async (req, res) => {
  try {
    const { unit_id, payment_plan_id, duration_days } = req.body || {}
    const uid = num(unit_id)
    if (!uid) return bad(res, 400, 'unit_id is required')
    const pid = payment_plan_id ? num(payment_plan_id) : null
    // Check unit available
    const u = await pool.query('SELECT id, available FROM units WHERE id=$1', [uid])
    if (u.rows.length === 0) return bad(res, 404, 'Unit not found')
    if (u.rows[0].available === false) return bad(res, 400, 'Unit is not available')
    // Duration validation 1-7
    let days = Number(duration_days) || 7
    if (days < 1) days = 1
    if (days > 7) days = 7
    const r = await pool.query(
      `INSERT INTO holds (unit_id, payment_plan_id, requested_by, status, expires_at)
       VALUES ($1, $2, $3, 'pending_approval', now() + ($4 || ' days')::interval)
       RETURNING *`,
      [uid, pid, req.user.id, String(days)]
    )
    return ok(res, { hold: r.rows[0] })
  } catch (e) {
    console.error('POST /api/inventory/holds error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.get('/holds', authMiddleware, requireRole(['financial_manager', 'sales_manager', 'admin', 'superadmin']), async (req, res) => {
  try {
    const { status } = req.query || {}
    const clauses = []
    const params = []
    if (status) { params.push(String(status)); clauses.push(`status=${params.length}`) }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const r = await pool.query(`SELECT * FROM holds ${where} ORDER BY id DESC`, params)
    return ok(res, { holds: r.rows })
  } catch (e) {
    console.error('GET /api/inventory/holds error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.patch('/holds/:id/approve', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  const client = await pool.connect()
  try {
    const id = num(req.params.id)
    if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
    await client.query('BEGIN')
    const cur = await client.query('SELECT * FROM holds WHERE id=$1', [id])
    if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Hold not found') }
    if (cur.rows[0].status !== 'pending_approval') { await client.query('ROLLBACK'); client.release(); return bad(res, 400, 'Hold not pending') }
    const expiresAt = cur.rows[0].expires_at ? new Date(cur.rows[0].expires_at) : new Date(Date.now() + 7 * 24 * 3600 * 1000)
    const nextNotify = new Date(expiresAt.getTime())
    const upd = await client.query(
      `UPDATE holds
       SET status='approved', approved_by=$1, expires_at=$2, next_notify_at=$3, updated_at=now()
       WHERE id=$4 RETURNING *`,
      [req.user.id, expiresAt.toISOString(), nextNotify.toISOString(), id]
    )
    // Block unit
    await client.query('UPDATE units SET available=FALSE, updated_at=now() WHERE id=$1', [cur.rows[0].unit_id])
    await client.query('COMMIT'); client.release()
    return ok(res, { hold: upd.rows[0] })
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    client.release()
    console.error('PATCH /api/inventory/holds/:id/approve error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.patch('/holds/:id/unblock', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  const client = await pool.connect()
  try {
    const id = num(req.params.id)
    if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
    await client.query('BEGIN')
    const cur = await client.query('SELECT * FROM holds WHERE id=$1', [id])
    if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Hold not found') }
    const upd = await client.query(
      `UPDATE holds SET status='unblocked', updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    )
    await client.query('UPDATE units SET available=TRUE, updated_at=now() WHERE id=$1', [cur.rows[0].unit_id])
    await client.query('COMMIT'); client.release()
    return ok(res, { hold: upd.rows[0] })
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    client.release()
    console.error('PATCH /api/inventory/holds/:id/unblock error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.patch('/holds/:id/extend', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  try {
    const id = num(req.params.id)
    if (!id) return bad(res, 400, 'Invalid id')
    const r = await pool.query(
      `UPDATE holds SET expires_at = COALESCE(expires_at, now()) + INTERVAL '7 days', next_notify_at = COALESCE(expires_at, now()) + INTERVAL '7 days', updated_at=now()
       WHERE id=$1 AND status='approved'
       RETURNING *`,
      [id]
    )
    if (r.rows.length === 0) return bad(res, 404, 'Hold not found or not approved')
    return ok(res, { hold: r.rows[0] })
  } catch (e) {
    console.error('PATCH /api/inventory/holds/:id/extend error:', e)
    return bad(res, 500, 'Internal error')
  }
})

// Override unblock (FM can override after CEO approvals elsewhere) if unit not reserved
/**
 * Override-unblock flow:
 * 1) FM requests override -> status 'pending_override_ceo' and notify CEOs
 * 2) CEO approves -> status 'override_ceo_approved' and notify FMs + consultant
 * 3) FM executes override-unblock -> set available=true, status 'unblocked' and notify consultant + CEOs
 */
router.post('/holds/:id/override-request', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  const client = await pool.connect()
  try {
    const id = num(req.params.id)
    if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
    await client.query('BEGIN')
    const cur = await client.query('SELECT * FROM holds WHERE id=$1', [id])
    if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Hold not found') }
    const hold = cur.rows[0]
    // cannot request override if already reserved
    if (hold.payment_plan_id) {
      const rf = await client.query(`SELECT 1 FROM reservation_forms WHERE payment_plan_id=$1 AND status='approved' LIMIT 1`, [hold.payment_plan_id])
      if (rf.rows.length > 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 400, 'Cannot override: unit is reserved') }
    }
    const upd = await client.query(
      `UPDATE holds SET status='pending_override_ceo', updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    )
    // notify all CEOs
    await client.query(
      `INSERT INTO notifications (user_id, type, ref_table, ref_id, message)
       SELECT u.id, 'hold_override_request', 'holds', $1, 'Hold override requested and awaits CEO approval.'
       FROM users u WHERE u.role='ceo' AND u.active=TRUE`,
      [id]
    )
    await client.query('COMMIT'); client.release()
    return ok(res, { hold: upd.rows[0] })
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    client.release()
    console.error('POST /api/inventory/holds/:id/override-request error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.patch('/holds/:id/override-approve', authMiddleware, requireRole(['ceo']), async (req, res) => {
  const client = await pool.connect()
  try {
    const id = num(req.params.id)
    if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
    await client.query('BEGIN')
    const cur = await client.query('SELECT * FROM holds WHERE id=$1', [id])
    if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Hold not found') }
    if (cur.rows[0].status !== 'pending_override_ceo') { await client.query('ROLLBACK'); client.release(); return bad(res, 400, 'Not pending CEO override approval') }
    const upd = await client.query(
      `UPDATE holds SET status='override_ceo_approved', updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    )
    // Notify all Financial Managers and the requesting consultant
    await client.query(
      `INSERT INTO notifications (user_id, type, ref_table, ref_id, message)
       SELECT u.id, 'hold_override_ceo_approved', 'holds', $1, 'CEO approved hold override. You may unblock the unit.'
       FROM users u WHERE u.role='financial_manager' AND u.active=TRUE`,
      [id]
    )
    const requestedBy = cur.rows[0].requested_by
    if (requestedBy) {
      await client.query(
        `INSERT INTO notifications (user_id, type, ref_table, ref_id, message)
         VALUES ($1, 'hold_override_ceo_approved', 'holds', $2, 'CEO approved hold override for your request.')`,
        [requestedBy, id]
      )
    }
    await client.query('COMMIT'); client.release()
    return ok(res, { hold: upd.rows[0] })
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    client.release()
    console.error('PATCH /api/inventory/holds/:id/override-approve error:', e)
    return bad(res, 500, 'Internal error')
  }
})

router.patch('/holds/:id/override-unblock', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  const client = await pool.connect()
  try {
    const id = num(req.params.id)
    if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
    await client.query('BEGIN')
    const cur = await client.query('SELECT * FROM holds WHERE id=$1', [id])
    if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Hold not found') }
    const hold = cur.rows[0]
    if (hold.status !== 'override_ceo_approved') { await client.query('ROLLBACK'); client.release(); return bad(res, 400, 'CEO approval required before override-unblock') }
    if (hold.payment_plan_id) {
      const rf = await client.query(
        `SELECT 1 FROM reservation_forms WHERE payment_plan_id=$1 AND status='approved' LIMIT 1`,
        [hold.payment_plan_id]
      )
      if (rf.rows.length > 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 400, 'Cannot override: unit is reserved') }
    }
    const upd = await client.query(
      `UPDATE holds SET status='unblocked', updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    )
    await client.query('UPDATE units SET available=TRUE, updated_at=now() WHERE id=$1', [hold.unit_id])
    // Notify consultant and CEOs
    if (hold.requested_by) {
      await client.query(
        `INSERT INTO notifications (user_id, type, ref_table, ref_id, message)
         VALUES ($1, 'hold_override_unblocked', 'holds', $2, 'Your hold has been overridden and unblocked by Financial Manager.')`,
        [hold.requested_by, id]
      )
    }
    await client.query(
      `INSERT INTO notifications (user_id, type, ref_table, ref_id, message)
       SELECT u.id, 'hold_override_unblocked', 'holds', $1, 'Hold was unblocked after CEO approval.'
       FROM users u WHERE u.role='ceo' AND u.active=TRUE`,
      [id]
    )
    await client.query('COMMIT'); client.release()
    return ok(res, { hold: upd.rows[0] })
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    client.release()
    console.error('PATCH /api/inventory/holds/:id/override-unblock error:', e)
    return bad(res, 500, 'Internal error')
  }
})

// Notifications list (for financial manager)
router.get('/notifications', authMiddleware, requireRole(['financial_manager', 'admin', 'superadmin']), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM notifications WHERE user_id=$1 AND read=FALSE ORDER BY id DESC`,
      [req.user.id]
    )
    return ok(res, { notifications: r.rows })
  } catch (e) {
    console.error('GET /api/inventory/notifications error:', e)
    return bad(res, 500, 'Internal error')
  }
})

export default router