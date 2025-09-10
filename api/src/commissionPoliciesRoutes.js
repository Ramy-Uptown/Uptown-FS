import express from 'express'
import { pool } from './db.js'
import { authMiddleware } from './authRoutes.js'

const router = express.Router()

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: { message: 'Admin only' } })
  next()
}

// List
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '50', 10)))
    const offset = (page - 1) * pageSize
    const c = await pool.query('SELECT COUNT(*)::int AS c FROM commission_policies')
    const total = c.rows[0]?.c || 0
    const rows = await pool.query('SELECT * FROM commission_policies ORDER BY id DESC LIMIT $1 OFFSET $2', [pageSize, offset])
    return res.json({ ok: true, policies: rows.rows, pagination: { page, pageSize, total } })
  } catch (e) {
    console.error('GET /api/commission-policies error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, description, rules, active } = req.body || {}
    if (!name || typeof name !== 'string') return res.status(400).json({ error: { message: 'name is required' } })
    const r = await pool.query(
      'INSERT INTO commission_policies (name, description, rules, active) VALUES ($1,$2,$3,$4) RETURNING *',
      [name.trim(), description || null, rules || {}, active != null ? !!active : true]
    )
    return res.json({ ok: true, policy: r.rows[0] })
  } catch (e) {
    console.error('POST /api/commission-policies error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

router.patch('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r0 = await pool.query('SELECT * FROM commission_policies WHERE id=$1', [id])
    if (r0.rows.length === 0) return res.status(404).json({ error: { message: 'Not found' } })
    const p0 = r0.rows[0]
    const { name, description, rules, active } = req.body || {}
    const r = await pool.query(
      'UPDATE commission_policies SET name=$1, description=$2, rules=$3, active=$4 WHERE id=$5 RETURNING *',
      [name ?? p0.name, description ?? p0.description, rules ?? p0.rules, active != null ? !!active : p0.active, id]
    )
    return res.json({ ok: true, policy: r.rows[0] })
  } catch (e) {
    console.error('PATCH /api/commission-policies/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r = await pool.query('DELETE FROM commission_policies WHERE id=$1 RETURNING id', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: { message: 'Not found' } })
    return res.json({ ok: true, id })
  } catch (e) {
    console.error('DELETE /api/commission-policies/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export default router