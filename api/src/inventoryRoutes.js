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

export default router