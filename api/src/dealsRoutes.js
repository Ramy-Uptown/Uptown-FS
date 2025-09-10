import express from 'express'
import { pool } from './db.js'
import { authMiddleware, adminOnly } from './authRoutes.js'

const router = express.Router()

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

async function logHistory(dealId, userId, action, notes = null) {
  await pool.query(
    'INSERT INTO deal_history (deal_id, user_id, action, notes) VALUES ($1, $2, $3, $4)',
    [dealId, userId, action, notes]
  )
}

function toNumber(v) {
  const n = Number(v)
  return isFinite(n) ? n : null
}

// List deals with optional filtering, pagination and sort
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      status,
      search,
      creatorId,
      creatorEmail,
      reviewerId,
      reviewerEmail,
      approverId,
      approverEmail,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      unitType,
      sortBy,
      sortDir
    } = req.query

    const page = Math.max(1, parseInt(req.query.page || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)))
    const offset = (page - 1) * pageSize

    const where = []
    const params = []

    if (status && typeof status === 'string') {
      params.push(status)
      where.push(`d.status = ${params.length}`)
    }
    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`)
      where.push(`(LOWER(d.title) LIKE ${params.length})`)
    }
    if (creatorId && toNumber(creatorId)) {
      params.push(toNumber(creatorId))
      where.push(`d.created_by = ${params.length}`)
    }
    if (creatorEmail && typeof creatorEmail === 'string' && creatorEmail.trim()) {
      params.push(creatorEmail.trim().toLowerCase())
      where.push(`EXISTS (SELECT 1 FROM users cu WHERE cu.id=d.created_by AND LOWER(cu.email) = ${params.length})`)
    }
    if (reviewerId && toNumber(reviewerId)) {
      params.push(toNumber(reviewerId))
      where.push(`EXISTS (SELECT 1 FROM deal_history h WHERE h.deal_id=d.id AND h.action='submit' AND h.user_id=${params.length})`)
    }
    if (reviewerEmail && typeof reviewerEmail === 'string' && reviewerEmail.trim()) {
      params.push(reviewerEmail.trim().toLowerCase())
      where.push(`EXISTS (
        SELECT 1 FROM deal_history h
        JOIN users ru ON ru.id = h.user_id
        WHERE h.deal_id=d.id AND h.action='submit' AND LOWER(ru.email) = ${params.length}
      )`)
    }
    if (approverId && toNumber(approverId)) {
      params.push(toNumber(approverId))
      where.push(`EXISTS (SELECT 1 FROM deal_history h WHERE h.deal_id=d.id AND h.action='approve' AND h.user_id=${params.length})`)
    }
    if (approverEmail && typeof approverEmail === 'string' && approverEmail.trim()) {
      params.push(approverEmail.trim().toLowerCase())
      where.push(`EXISTS (
        SELECT 1 FROM deal_history h
        JOIN users au ON au.id = h.user_id
        WHERE h.deal_id=d.id AND h.action='approve' AND LOWER(au.email) = ${params.length}
      )`)
    }
    if (startDate) {
      params.push(new Date(startDate))
      where.push(`d.created_at >= ${params.length}`)
    }
    if (endDate) {
      params.push(new Date(endDate))
      where.push(`d.created_at <= ${params.length}`)
    }
    if (minAmount && toNumber(minAmount) != null) {
      params.push(toNumber(minAmount))
      where.push(`d.amount >= ${params.length}`)
    }
    if (maxAmount && toNumber(maxAmount) != null) {
      params.push(toNumber(maxAmount))
      where.push(`d.amount <= ${params.length}`)
    }
    if (unitType && typeof unitType === 'string' && unitType.trim()) {
      params.push(unitType.trim())
      where.push(`d.unit_type = ${params.length}`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const sortCols = {
      id: 'd.id',
      title: 'd.title',
      amount: 'd.amount',
      status: 'd.status',
      created_at: 'd.created_at',
      updated_at: 'd.updated_at'
    }
    const sortCol = sortCols[String(sortBy || '').toLowerCase()] || 'd.id'
    const dir = String(sortDir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    const countSql = `SELECT COUNT(*)::int AS c FROM deals d ${whereSql}`
    const countRes = await pool.query(countSql, params)
    const total = countRes.rows[0]?.c || 0

    params.push(pageSize)
    params.push(offset)
    const listSql = `
      SELECT d.*, u.email as created_by_email
      FROM deals d
      LEFT JOIN users u ON u.id = d.created_by
      ${whereSql}
      ORDER BY ${sortCol} ${dir}
      LIMIT ${params.length - 1} OFFSET ${params.length}
    `
    const rows = await pool.query(listSql, params)

    return res.json({ ok: true, deals: rows.rows, pagination: { page, pageSize, total } })
  } catch (e) {
    console.error('GET /api/deals error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Get single deal by id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const q = await pool.query(
      `SELECT d.*, u.email as created_by_email
       FROM deals d LEFT JOIN users u ON u.id = d.created_by
       WHERE d.id=$1`,
      [id]
    )
    if (q.rows.length === 0) return res.status(404).json({ error: { message: 'Deal not found' } })
    return res.json({ ok: true, deal: q.rows[0] })
  } catch (e) {
    console.error('GET /api/deals/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Deal history
router.get('/:id/history', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const rows = await pool.query(
      `SELECT h.*, u.email as user_email
       FROM deal_history h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.deal_id=$1
       ORDER BY h.id ASC`,
      [id]
    )
    return res.json({ ok: true, history: rows.rows })
  } catch (e) {
    console.error('GET /api/deals/:id/history error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Create a new deal (any authenticated user)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, amount, details, unitType, salesRepId } = req.body || {}
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: { message: 'title is required' } })
    }
    const amt = Number(amount || 0)
    const det = isObject(details) ? details : {}
    const result = await pool.query(
      'INSERT INTO deals (title, amount, details, unit_type, sales_rep_id, status, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title.trim(), isFinite(amt) ? amt : 0, det, unitType || null, salesRepId || null, 'draft', req.user.id]
    )
    const deal = result.rows[0]
    await logHistory(deal.id, req.user.id, 'create', null)
    return res.json({ ok: true, deal })
  } catch (e) {
    console.error('POST /api/deals error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Modify an existing deal (only if status is draft; owner or admin)
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { title, amount, details, unitType, salesRepId } = req.body || {}
    const q = await pool.query('SELECT * FROM deals WHERE id=$1', [id])
    if (q.rows.length === 0) return res.status(404).json({ error: { message: 'Deal not found' } })
    const deal = q.rows[0]
    const isOwner = deal.created_by === req.user.id
    const isAdmin = req.user.role === 'admin'
    if (deal.status !== 'draft') return res.status(400).json({ error: { message: 'Only draft deals can be modified' } })
    if (!isOwner && !isAdmin) return res.status(403).json({ error: { message: 'Forbidden' } })

    const newTitle = typeof title === 'string' && title.trim() ? title.trim() : deal.title
    const newAmount = amount != null && isFinite(Number(amount)) ? Number(amount) : deal.amount
    const newDetails = isObject(details) ? details : deal.details
    const newUnitType = typeof unitType === 'string' && unitType.trim() ? unitType.trim() : deal.unit_type
    const newSalesRepId = salesRepId !== undefined ? (salesRepId || null) : deal.sales_rep_id

    const upd = await pool.query(
      'UPDATE deals SET title=$1, amount=$2, details=$3, unit_type=$4, sales_rep_id=$5 WHERE id=$6 RETURNING *',
      [newTitle, newAmount, newDetails, newUnitType, newSalesRepId, id]
    )
    const updated = upd.rows[0]
    await logHistory(id, req.user.id, 'modify', null)
    return res.json({ ok: true, deal: updated })
  } catch (e) {
    console.error('PATCH /api/deals/:id error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Submit for approval (only from draft -> pending_approval; owner or admin)
router.post('/:id/submit', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const q = await pool.query('SELECT * FROM deals WHERE id=$1', [id])
    if (q.rows.length === 0) return res.status(404).json({ error: { message: 'Deal not found' } })
    const deal = q.rows[0]
    const isOwner = deal.created_by === req.user.id
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) return res.status(403).json({ error: { message: 'Forbidden' } })
    if (deal.status !== 'draft') return res.status(400).json({ error: { message: 'Deal must be draft to submit' } })

    const upd = await pool.query('UPDATE deals SET status=$1 WHERE id=$2 RETURNING *', ['pending_approval', id])
    await logHistory(id, req.user.id, 'submit', null)
    return res.json({ ok: true, deal: upd.rows[0] })
  } catch (e) {
    console.error('POST /api/deals/:id/submit error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Approve (manager or admin only; pending_approval -> approved)
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const role = req.user.role
    if (!(role === 'manager' || role === 'admin')) return res.status(403).json({ error: { message: 'Manager role required' } })

    const q = await pool.query('SELECT * FROM deals WHERE id=$1', [id])
    if (q.rows.length === 0) return res.status(404).json({ error: { message: 'Deal not found' } })
    const deal = q.rows[0]
    if (deal.status !== 'pending_approval') return res.status(400).json({ error: { message: 'Deal must be pending approval' } })

    const upd = await pool.query('UPDATE deals SET status=$1 WHERE id=$2 RETURNING *', ['approved', id])
    await logHistory(id, req.user.id, 'approve', null)
    return res.json({ ok: true, deal: upd.rows[0] })
  } catch (e) {
    console.error('POST /api/deals/:id/approve error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Reject (manager or admin only; pending_approval -> rejected)
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { reason } = req.body || {}
    const role = req.user.role
    if (!(role === 'manager' || role === 'admin')) return res.status(403).json({ error: { message: 'Manager role required' } })

    const q = await pool.query('SELECT * FROM deals WHERE id=$1', [id])
    if (q.rows.length === 0) return res.status(404).json({ error: { message: 'Deal not found' } })
    const deal = q.rows[0]
    if (deal.status !== 'pending_approval') return res.status(400).json({ error: { message: 'Deal must be pending approval' } })

    const upd = await pool.query('UPDATE deals SET status=$1 WHERE id=$2 RETURNING *', ['rejected', id])
    await logHistory(id, req.user.id, 'reject', typeof reason === 'string' ? reason : null)
    return res.json({ ok: true, deal: upd.rows[0] })
  } catch (e) {
    console.error('POST /api/deals/:id/reject error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export default router