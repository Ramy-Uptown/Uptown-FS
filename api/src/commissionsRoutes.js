import express from 'express'
import { pool } from './db.js'
import { authMiddleware } from './authRoutes.js'

const router = express.Router()

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: { message: 'Admin only' } })
  next()
}

// Simple calculator supporting percentage and tiered rules
function calculateCommission(amount, rules) {
  const amt = Number(amount) || 0
  if (amt <= 0) return { amount: 0, details: { reason: 'zero_amount' } }
  if (!rules || typeof rules !== 'object') return { amount: 0, details: { reason: 'no_rules' } }

  if (rules.type === 'percentage') {
    const rate = Number(rules.rate) || 0
    const res = Math.max(0, amt * rate / 100)
    return { amount: res, details: { mode: 'percentage', rate } }
  }

  if (rules.type === 'tiered' && Array.isArray(rules.tiers)) {
    // tiers: [{ upTo: number | null, rate: percent }]
    let remaining = amt
    let total = 0
    const applied = []
    for (const t of rules.tiers) {
      const upTo = t.upTo == null ? remaining : Math.max(0, Math.min(remaining, Number(t.upTo)))
      const rate = Number(t.rate) || 0
      if (upTo > 0) {
        const part = upTo * rate / 100
        total += part
        applied.push({ base: upTo, rate, commission: part })
        remaining -= upTo
      }
      if (remaining <= 0) break
    }
    return { amount: total, details: { mode: 'tiered', applied } }
  }

  return { amount: 0, details: { mode: 'unknown' } }
}

// Calculate and save commission for a deal and sales person
router.post('/calc-and-save', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { deal_id, sales_person_id, policy_id } = req.body || {}
    const dres = await pool.query('SELECT * FROM deals WHERE id=$1', [deal_id])
    if (dres.rows.length === 0) return res.status(404).json({ error: { message: 'Deal not found' } })
    const deal = dres.rows[0]

    const sres = await pool.query('SELECT * FROM sales_people WHERE id=$1', [sales_person_id])
    if (sres.rows.length === 0) return res.status(404).json({ error: { message: 'Sales person not found' } })
    const sales = sres.rows[0]

    let policy
    if (policy_id) {
      const pres = await pool.query('SELECT * FROM commission_policies WHERE id=$1', [policy_id])
      if (pres.rows.length === 0) return res.status(404).json({ error: { message: 'Policy not found' } })
      policy = pres.rows[0]
    } else {
      const pres = await pool.query('SELECT * FROM commission_policies WHERE active=true ORDER BY id DESC LIMIT 1')
      if (pres.rows.length === 0) return res.status(400).json({ error: { message: 'No active commission policies' } })
      policy = pres.rows[0]
    }

    const { amount, details } = calculateCommission(deal.amount, policy.rules)
    const ins = await pool.query(
      `INSERT INTO deal_commissions (deal_id, sales_person_id, policy_id, amount, details)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [deal.id, sales.id, policy.id, amount, { ...details, deal_amount: deal.amount }]
    )

    return res.json({ ok: true, commission: ins.rows[0], deal, sales, policy })
  } catch (e) {
    console.error('POST /api/commissions/calc-and-save error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Report with filters
router.get('/report', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { sales_person_id, policy_id, startDate, endDate } = req.query
    const where = []
    const params = []

    if (sales_person_id) { params.push(Number(sales_person_id)); where.push(`dc.sales_person_id=$${params.length}`) }
    if (policy_id) { params.push(Number(policy_id)); where.push(`dc.policy_id=$${params.length}`) }
    if (startDate) { params.push(new Date(startDate)); where.push(`dc.calculated_at >= $${params.length}`) }
    if (endDate) { params.push(new Date(endDate)); where.push(`dc.calculated_at <= $${params.length}`) }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await pool.query(
      `SELECT dc.*, sp.name AS sales_name, sp.email AS sales_email, cp.name AS policy_name, d.title AS deal_title
       FROM deal_commissions dc
       LEFT JOIN sales_people sp ON sp.id = dc.sales_person_id
       LEFT JOIN commission_policies cp ON cp.id = dc.policy_id
       LEFT JOIN deals d ON d.id = dc.deal_id
       ${whereSql}
       ORDER BY dc.id DESC
       LIMIT 500`
      , params
    )
    // Aggregate total
    const total = rows.rows.reduce((s, r) => s + Number(r.amount || 0), 0)
    return res.json({ ok: true, commissions: rows.rows, total })
  } catch (e) {
    console.error('GET /api/commissions/report error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export default router