import express from 'express'
import { pool } from './db.js'
import { authMiddleware, requireRole } from './authRoutes.js'

const router = express.Router()

function bad(res, code, message, details) {
  return res.status(code).json({ error: { message, details }, timestamp: new Date().toISOString() })
}
function ok(res, payload) { return res.json({ ok: true, ...payload }) }
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null }

router.get('/workflow-logs', authMiddleware, requireRole(['ceo', 'chairman', 'vice_chairman', 'admin', 'superadmin']), async (req, res) => {
  try {
    const { startDate, endDate, type, consultant_id, manager_id } = req.query || {}
    const start = startDate ? new Date(startDate) : null
    const end = endDate ? new Date(endDate) : null
    const cid = consultant_id ? toNum(consultant_id) : null
    const mid = manager_id ? toNum(manager_id) : null

    // Offers (payment_plans)
    let offers = []
    let offerTotal = 0
    if (!type || type === 'offer' || type === 'offers') {
      const where = []
      const params = []
      if (cid) { params.push(cid); where.push(`pp.created_by = $${params.length}`) }
      if (mid) {
        params.push(mid)
        where.push(`pp.created_by IN (SELECT consultant_user_id FROM sales_team_members WHERE manager_user_id=$${params.length} AND active=TRUE)`)
      }
      if (start) { params.push(start.toISOString()); where.push(`pp.created_at >= $${params.length}`) }
      if (end) { params.push(end.toISOString()); where.push(`pp.created_at <= $${params.length}`) }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const q = `
        SELECT pp.id, pp.deal_id, pp.status, pp.version, pp.accepted, pp.created_at, pp.updated_at,
               pp.created_by,
               u.email AS created_by_email,
               u.name AS created_by_name,
               -- pick one active manager if any
               (SELECT stm.manager_user_id FROM sales_team_members stm WHERE stm.consultant_user_id=pp.created_by AND stm.active=TRUE LIMIT 1) AS manager_user_id,
               (SELECT um.email FROM users um WHERE um.id = (SELECT stm.manager_user_id FROM sales_team_members stm WHERE stm.consultant_user_id=pp.created_by AND stm.active=TRUE LIMIT 1)) AS manager_email,
               (SELECT um.name FROM users um WHERE um.id = (SELECT stm.manager_user_id FROM sales_team_members stm WHERE stm.consultant_user_id=pp.created_by AND stm.active=TRUE LIMIT 1)) AS manager_name,
               COALESCE( (pp.details->>'totalNominalPrice')::numeric,
                         (pp.details->'data'->>'totalNominalPrice')::numeric,
                         0) AS total_nominal
        FROM payment_plans pp
        LEFT JOIN users u ON u.id = pp.created_by
        ${whereSql}
        ORDER BY pp.id DESC`
      const rows = await pool.query(q, params)
      offers = rows.rows
      offerTotal = offers.reduce((s, r) => s + (Number(r.total_nominal) || 0), 0)
    }

    // Reservations
    let reservations = []
    let reservationTotal = 0
    if (!type || type === 'reservation' || type === 'reservations') {
      const where = []
      const params = []
      if (cid) { params.push(cid); where.push(`pp.created_by = $${params.length}`) }
      if (mid) {
        params.push(mid)
        where.push(`pp.created_by IN (SELECT consultant_user_id FROM sales_team_members WHERE manager_user_id=$${params.length} AND active=TRUE)`)
      }
      if (start) { params.push(start.toISOString()); where.push(`rf.created_at >= $${params.length}`) }
      if (end) { params.push(end.toISOString()); where.push(`rf.created_at <= $${params.length}`) }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const q = `
        SELECT rf.id, rf.payment_plan_id, rf.status, rf.created_at, rf.updated_at,
               pp.created_by,
               u.email AS created_by_email,
               u.name AS created_by_name,
               (SELECT stm.manager_user_id FROM sales_team_members stm WHERE stm.consultant_user_id=pp.created_by AND stm.active=TRUE LIMIT 1) AS manager_user_id,
               (SELECT um.email FROM users um WHERE um.id = (SELECT stm.manager_user_id FROM sales_team_members stm WHERE stm.consultant_user_id=pp.created_by AND stm.active=TRUE LIMIT 1)) AS manager_email,
               (SELECT um.name FROM users um WHERE um.id = (SELECT stm.manager_user_id FROM sales_team_members stm WHERE stm.consultant_user_id=pp.created_by AND stm.active=TRUE LIMIT 1)) AS manager_name,
               COALESCE( (pp.details->>'totalNominalPrice')::numeric,
                         (pp.details->'data'->>'totalNominalPrice')::numeric,
                         0) AS total_nominal
        FROM reservation_forms rf
        JOIN payment_plans pp ON pp.id = rf.payment_plan_id
        LEFT JOIN users u ON u.id = pp.created_by
        ${whereSql}
        ORDER BY rf.id DESC`
      const rows = await pool.query(q, params)
      reservations = rows.rows
      reservationTotal = reservations.reduce((s, r) => s + (Number(r.total_nominal) || 0), 0)
    }

    // Contracts
    let contracts = []
    let contractTotal = 0
    if (!type || type === 'contract' || type === 'contracts') {
      const where = []
      const params = []
      if (cid) { params.push(cid); where.push(`pp.created_by = $${params.length}`) }
      if (mid) {
        params.push(mid)
        where.push(`pp.created_by IN (SELECT consultant_user_id FROM sales_team_members WHERE manager_user_id=$${params.length} AND active=TRUE)`)
      }
      if (start) { params.push(start.toISOString()); where.push(`c.created_at >= $${params.length}`) }
      if (end) { params.push(end.toISOString()); where.push(`c.created_at <= $${params.length}`) }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const q = `
        SELECT c.id, c.reservation_form_id, c.status, c.created_at, c.updated_at,
               pp.created_by,
               u.email AS created_by_email,
               u.name AS created_by_name,
               (SELECT stm.manager_user_id FROM sales_team_members stm WHERE stm.consultant_user_id=pp.created_by AND stm.active=TRUE LIMIT 1) AS manager_user_id,
               (SELECT um.email FROM users um WHERE um.id = (SELECT stm.manager_user_id FROM sales_team_members stm WHERE stm.consultant_user_id=pp.created_by AND stm.active=TRUE LIMIT 1)) AS manager_email,
               (SELECT um.name FROM users um WHERE um.id = (SELECT stm.manager_user_id FROM sales_team_members stm WHERE stm.consultant_user_id=pp.created_by AND stm.active=TRUE LIMIT 1)) AS manager_name,
               COALESCE( (pp.details->>'totalNominalPrice')::numeric,
                         (pp.details->'data'->>'totalNominalPrice')::numeric,
                         0) AS total_nominal
        FROM contracts c
        JOIN reservation_forms rf ON rf.id = c.reservation_form_id
        JOIN payment_plans pp ON pp.id = rf.payment_plan_id
        LEFT JOIN users u ON u.id = pp.created_by
        ${whereSql}
        ORDER BY c.id DESC`
      const rows = await pool.query(q, params)
      contracts = rows.rows
      contractTotal = contracts.reduce((s, r) => s + (Number(r.total_nominal) || 0), 0)
    }

    const grandTotal = offerTotal + reservationTotal + contractTotal
    return ok(res, {
      filters: { startDate, endDate, type, consultant_id: cid, manager_id: mid },
      offers: { rows: offers, total: offerTotal },
      reservations: { rows: reservations, total: reservationTotal },
      contracts: { rows: contracts, total: contractTotal },
      grandTotal
    })
  } catch (e) {
    console.error('GET /api/reports/workflow-logs error:', e)
    return bad(res, 500, 'Internal error')
  }
})

export default router