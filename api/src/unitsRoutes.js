import express from 'express'
import { pool } from './db.js'
import { authMiddleware } from './authRoutes.js'

const router = express.Router()

// List units (with optional search, pagination)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim().toLowerCase()
    const page = Math.max(1, parseInt(req.query.page || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '50', 10)))
    const offset = (page - 1) * pageSize

    const where = []
    const params = []
    if (search) {
      params.push(`%${search}%`)
      where.push(`(LOWER(code) LIKE ${params.length} OR LOWER(description) LIKE ${params.length})`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const countRes = await pool.query(`SELECT COUNT(*)::int AS c FROM units ${whereSql}`, params)
    const total = countRes.rows[0]?.c || 0

    params.push(pageSize)
    params.push(offset)
    const listSql = `
      SELECT *
      FROM units
      ${whereSql}
      ORDER BY id DESC
      LIMIT ${params.length - 1} OFFSET ${params.length}
    `
    const rows = await pool.query(listSql, params)
    return res.json({ ok: true, units: rows.rows, pagination: { page, pageSize, total } })
  } catch (e) {
    console.error('GET /api/units error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Get a unit
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r = await pool.query('SELECT * FROM units WHERE id=$1', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: { message: 'Unit not found' } })
    return res.json({ ok: true, unit: r.rows[0] })
  } catch (e) {
    console.error('GET /api/units/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Admin/Finance Admin guard helper
function requireAdminLike(req, res, next) {
  const role = req.user?.role
  if (!['admin', 'superadmin', 'financial_admin'].includes(role)) {
    return res.status(403).json({ error: { message: 'Forbidden' } })
  }
  next()
}

// Create unit
router.post('/', authMiddleware, requireAdminLike, async (req, res) => {
  try {
    const role = req.user?.role
    const { code, description, unit_type, base_price, currency, model_id, unit_type_id } = req.body || {}
    if (!code || typeof code !== 'string') return res.status(400).json({ error: { message: 'code is required' } })
    const price = Number(base_price || 0)
    const cur = (currency || 'EGP').toString().toUpperCase()

    // financial_admin must not set model_id directly; use link-request workflow
    if (role === 'financial_admin' && model_id != null) {
      return res.status(400).json({ error: { message: 'Financial Admin cannot set model_id directly. Use /api/inventory/units/:id/link-request after creating the unit.' } })
    }

    // Optional unit_type_id
    let utid = null
    if (unit_type_id != null) {
      const t = await pool.query('SELECT id FROM unit_types WHERE id=$1', [Number(unit_type_id)])
      if (t.rows.length === 0) return res.status(400).json({ error: { message: 'Invalid unit_type_id' } })
      utid = Number(unit_type_id)
    }

    let mid = null
    if (model_id != null) {
      // Only admin/superadmin can set directly (bypassing workflow)
      const m = await pool.query('SELECT id FROM unit_models WHERE id=$1', [Number(model_id)])
      if (m.rows.length === 0) return res.status(400).json({ error: { message: 'Invalid model_id' } })
      mid = Number(model_id)
    }

    const r = await pool.query(
      'INSERT INTO units (code, description, unit_type, unit_type_id, base_price, currency, model_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [code.trim(), description || null, unit_type || null, utid, isFinite(price) ? price : 0, cur, mid]
    )
    return res.json({ ok: true, unit: r.rows[0] })
  } catch (e) {
    console.error('POST /api/units error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Update unit
router.patch('/:id', authMiddleware, requireAdminLike, async (req, res) => {
  try {
    const role = req.user?.role
    const id = Number(req.params.id)
    const { code, description, unit_type, base_price, currency, model_id, unit_type_id } = req.body || {}
    const r0 = await pool.query('SELECT * FROM units WHERE id=$1', [id])
    if (r0.rows.length === 0) return res.status(404).json({ error: { message: 'Unit not found' } })
    const u = r0.rows[0]
    const newCode = typeof code === 'string' && code.trim() ? code.trim() : u.code
    const newDesc = typeof description === 'string' ? description : u.description
    const newType = typeof unit_type === 'string' ? unit_type : u.unit_type
    const price = base_price != null ? Number(base_price) : u.base_price
    const cur = typeof currency === 'string' ? currency.toUpperCase() : u.currency

    if (role === 'financial_admin' && model_id !== undefined) {
      return res.status(400).json({ error: { message: 'Financial Admin cannot set model_id directly. Use link-request workflow.' } })
    }

    let mid = u.model_id
    if (model_id !== undefined) {
      if (model_id === null || model_id === '') mid = null
      else {
        const m = await pool.query('SELECT id FROM unit_models WHERE id=$1', [Number(model_id)])
        if (m.rows.length === 0) return res.status(400).json({ error: { message: 'Invalid model_id' } })
        mid = Number(model_id)
      }
    }

    let utid = u.unit_type_id
    if (unit_type_id !== undefined) {
      if (unit_type_id === null || unit_type_id === '') utid = null
      else {
        const t = await pool.query('SELECT id FROM unit_types WHERE id=$1', [Number(unit_type_id)])
        if (t.rows.length === 0) return res.status(400).json({ error: { message: 'Invalid unit_type_id' } })
        utid = Number(unit_type_id)
      }
    }

    const r = await pool.query(
      'UPDATE units SET code=$1, description=$2, unit_type=$3, unit_type_id=$4, base_price=$5, currency=$6, model_id=$7 WHERE id=$8 RETURNING *',
      [newCode, newDesc, newType, utid, isFinite(price) ? price : u.base_price, cur, mid, id]
    )
    return res.json({ ok: true, unit: r.rows[0] })
  } catch (e) {
    console.error('PATCH /api/units/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Delete unit
router.delete('/:id', authMiddleware, requireAdminLike, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r = await pool.query('DELETE FROM units WHERE id=$1 RETURNING id', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: { message: 'Unit not found' } })
    return res.json({ ok: true, id })
  } catch (e) {
    console.error('DELETE /api/units/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export default router