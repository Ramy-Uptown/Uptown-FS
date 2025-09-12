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
    if (name != null) { params.push(String(name)); fields.push(`name=$${params.length}`) }
    if (description !== undefined) { params.push(description === null ? null : String(description)); fields.push(`description=$${params.length}`) }
    if (typeof active === 'boolean') { params.push(active); fields.push(`active=$${params.length}`) }
    if (fields.length === 0) return bad(res, 400, 'No fields to update')
    params.push(id)
    const r = await pool.query(`UPDATE unit_types SET ${fields.join(', ')}, updated_at=now() WHERE id=$${params.length} RETURNING *`, params)
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
// Inventory (units linked to types; only financial_manager can manage; readers broader)
//
router.patch('/units/:id', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  try {
    const id = num(req.params.id)
    if (!id) return bad(res, 400, 'Invalid unit id')
    const { unit_type_id, available } = req.body || {}
    const fields = []
    const params = []
    if (unit_type_id != null) { params.push(num(unit_type_id)); fields.push(`unit_type_id=$${params.length}`) }
    if (typeof available === 'boolean') { params.push(available); fields.push(`available=$${params.length}`) }
    if (fields.length === 0) return bad(res, 400, 'No fields to update')
    params.push(id)
    const r = await pool.query(`UPDATE units SET ${fields.join(', ')}, updated_at=now() WHERE id=$${params.length} RETURNING *`, params)
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
    if (unit_type_id) { params.push(num(unit_type_id)); clauses.push(`unit_type_id=$${params.length}`) }
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
    const { unit_id, payment_plan_id } = req.body || {}
    const uid = num(unit_id)
    if (!uid) return bad(res, 400, 'unit_id is required')
    const pid = payment_plan_id ? num(payment_plan_id) : null
    // Check unit available
    const u = await pool.query('SELECT id, available FROM units WHERE id=$1', [uid])
    if (u.rows.length === 0) return bad(res, 404, 'Unit not found')
    if (u.rows[0].available === false) return bad(res, 400, 'Unit is not available')
    const r = await pool.query(
      `INSERT INTO holds (unit_id, payment_plan_id, requested_by, status)
       VALUES ($1, $2, $3, 'pending_approval')
       RETURNING *`,
      [uid, pid, req.user.id]
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)
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
router.patch('/holds/:id/override-unblock', authMiddleware, requireRole(['financial_manager']), async (req, res) => {
  const client = await pool.connect()
  try {
    const id = num(req.params.id)
    if (!id) { client.release(); return bad(res, 400, 'Invalid id') }
    await client.query('BEGIN')
    const cur = await client.query('SELECT * FROM holds WHERE id=$1', [id])
    if (cur.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 404, 'Hold not found') }
    const hold = cur.rows[0]
    // If linked to a payment plan that already has an approved reservation, do not allow override
    if (hold.payment_plan_id) {
      const rf = await client.query(
        `SELECT 1 FROM reservation_forms WHERE payment_plan_id=$1 AND status='approved' LIMIT 1`,
        [hold.payment_plan_id]
      )
      if (rf.rows.length > 0) { await client.query('ROLLBACK'); client.release(); return bad(res, 400, 'Cannot override: unit is reserved') }
    }
    // Otherwise unblock
    const upd = await client.query(
      `UPDATE holds SET status='unblocked', updated_at=now() WHERE id=$1 RETURNING *`,
      [id]
    )
    await client.query('UPDATE units SET available=TRUE, updated_at=now() WHERE id=$1', [hold.unit_id])
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