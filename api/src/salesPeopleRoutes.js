import express from 'express'
import { pool } from './db.js'
import { authMiddleware } from './authRoutes.js'

const router = express.Router()

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: { message: 'Admin only' } })
  next()
}

// List/search sales people
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
      where.push(`(LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const c = await pool.query(`SELECT COUNT(*)::int AS c FROM sales_people ${whereSql}`, params)
    const total = c.rows[0]?.c || 0

    params.push(pageSize)
    params.push(offset)
    const rows = await pool.query(`
      SELECT * FROM sales_people
      ${whereSql}
      ORDER BY id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    return res.json({ ok: true, sales: rows.rows, pagination: { page, pageSize, total } })
  } catch (e) {
    console.error('GET /api/sales error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { user_id, name, email, role, active } = req.body || {}
    if (!name || typeof name !== 'string') return res.status(400).json({ error: { message: 'name is required' } })
    const r = await pool.query(
      'INSERT INTO sales_people (user_id, name, email, role, active) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [user_id || null, name.trim(), email || null, role || 'sales', active != null ? !!active : true]
    )
    return res.json({ ok: true, sales: r.rows[0] })
  } catch (e) {
    console.error('POST /api/sales error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

router.patch('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r0 = await pool.query('SELECT * FROM sales_people WHERE id=$1', [id])
    if (r0.rows.length === 0) return res.status(404).json({ error: { message: 'Not found' } })
    const s0 = r0.rows[0]
    const { user_id, name, email, role, active } = req.body || {}
    const r = await pool.query(
      'UPDATE sales_people SET user_id=$1, name=$2, email=$3, role=$4, active=$5 WHERE id=$6 RETURNING *',
      [user_id ?? s0.user_id, name ?? s0.name, email ?? s0.email, role ?? s0.role, active != null ? !!active : s0.active, id]
    )
    return res.json({ ok: true, sales: r.rows[0] })
  } catch (e) {
    console.error('PATCH /api/sales/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r = await pool.query('DELETE FROM sales_people WHERE id=$1 RETURNING id', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: { message: 'Not found' } })
    return res.json({ ok: true, id })
  } catch (e) {
    console.error('DELETE /api/sales/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export default router