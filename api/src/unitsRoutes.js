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
      where.push(`(LOWER(code) LIKE $${params.length} OR LOWER(description) LIKE $${params.length})`)
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
      LIMIT $${params.length - 1} OFFSET $${params.length}
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

// Admin guard helper
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: { message: 'Admin only' } })
  next()
}

// Create unit
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { code, description, unit_type, base_price, currency } = req.body || {}
    if (!code || typeof code !== 'string') return res.status(400).json({ error: { message: 'code is required' } })
    const price = Number(base_price || 0)
    const cur = (currency || 'EGP').toString().toUpperCase()
    const r = await pool.query(
      'INSERT INTO units (code, description, unit_type, base_price, currency) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [code.trim(), description || null, unit_type || null, isFinite(price) ? price : 0, cur]
    )
    return res.json({ ok: true, unit: r.rows[0] })
  } catch (e) {
    console.error('POST /api/units error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Update unit
router.patch('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { code, description, unit_type, base_price, currency } = req.body || {}
    const r0 = await pool.query('SELECT * FROM units WHERE id=$1', [id])
    if (r0.rows.length === 0) return res.status(404).json({ error: { message: 'Unit not found' } })
    const u = r0.rows[0]
    const newCode = typeof code === 'string' && code.trim() ? code.trim() : u.code
    const newDesc = typeof description === 'string' ? description : u.description
    const newType = typeof unit_type === 'string' ? unit_type : u.unit_type
    const price = base_price != null ? Number(base_price) : u.base_price
    const cur = typeof currency === 'string' ? currency.toUpperCase() : u.currency
    const r = await pool.query(
      'UPDATE units SET code=$1, description=$2, unit_type=$3, base_price=$4, currency=$5 WHERE id=$6 RETURNING *',
      [newCode, newDesc, newType, isFinite(price) ? price : u.base_price, cur, id]
    )
    return res.json({ ok: true, unit: r.rows[0] })
  } catch (e) {
    console.error('PATCH /api/units/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Delete unit
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
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