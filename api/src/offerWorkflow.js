import express from 'express'
import { pool } from './db.js'
import { authMiddleware, requireRole } from './authRoutes.js'

const router = express.Router()

// Complete offer status workflow
const OFFER_WORKFLOW = {
  draft: { next: ['pending_sm'], roles: ['property_consultant'] },
  pending_sm: { next: ['preliminary_approved', 'rejected', 'pending_fm'], roles: ['sales_manager'] },
  pending_fm: { next: ['preliminary_approved', 'rejected', 'pending_tm'], roles: ['financial_manager'] },
  pending_tm: { next: ['preliminary_approved', 'rejected'], roles: ['chairman', 'vice_chairman', 'ceo'] },
  // align with existing role naming: 'financial_admin' (not 'finance_admin')
  preliminary_approved: { next: ['reserved', 'cancelled'], roles: ['financial_admin', 'financial_manager'] },
  rejected: { next: ['draft'], roles: ['property_consultant'] },
  cancelled: { next: [], roles: [] },
  reserved: { next: [], roles: [] }
}

async function canTransition({ currentStatus, requestedStatus, userRole }) {
  const wf = OFFER_WORKFLOW[currentStatus]
  if (!wf) return { ok: false, reason: `Unknown current status: ${currentStatus}` }
  if (!wf.next.includes(requestedStatus)) {
    return { ok: false, reason: `Invalid transition from ${currentStatus} to ${requestedStatus}`, allowed: wf.next }
  }
  if (userRole === 'superadmin') return { ok: true }
  if (!wf.roles.includes(userRole)) {
    return { ok: false, reason: `Role ${userRole} cannot transition from ${currentStatus} to ${requestedStatus}`, required: wf.roles }
  }
  return { ok: true }
}

async function updateOfferStatusTx(client, offerId, newStatus, user, reason) {
  const curRes = await client.query('SELECT id, status, created_by FROM offers WHERE id=$1', [offerId])
  if (curRes.rows.length === 0) {
    return { ok: false, code: 404, message: 'Offer not found' }
  }
  const current = curRes.rows[0]
  const check = await canTransition({ currentStatus: current.status, requestedStatus: newStatus, userRole: user.role })
  if (!check.ok) {
    return { ok: false, code: 400, message: check.reason, allowed: check.allowed || [] }
  }

  const upd = await client.query(
    'UPDATE offers SET status=$1, updated_at=now() WHERE id=$2 RETURNING *',
    [newStatus, offerId]
  )

  await client.query(
    `INSERT INTO offer_history (offer_id, action, user_id, notes)
     VALUES ($1, $2, $3, $4)`,
    [offerId, `status_changed_${newStatus}`, user.id, reason || `Status changed to ${newStatus}`]
  )

  // Handle unit availability side-effect
  if (newStatus === 'preliminary_approved') {
    await client.query(
      'UPDATE units SET available=FALSE, updated_at=now() WHERE id=(SELECT unit_id FROM offers WHERE id=$1)',
      [offerId]
    )
  }
  if (newStatus === 'cancelled') {
    await client.query(
      'UPDATE units SET available=TRUE, updated_at=now() WHERE id=(SELECT unit_id FROM offers WHERE id=$1)',
      [offerId]
    )
  }

  return { ok: true, offer: upd.rows[0] }
}

// Update offer status with full workflow
router.patch('/offers/:id/status', authMiddleware, async (req, res) => {
  const { status, reason } = req.body || {}
  const offerId = parseInt(req.params.id, 10)

  if (!status || typeof status !== 'string') {
    return res.status(400).json({ error: { message: 'status is required' } })
  }
  if (!Number.isFinite(offerId)) {
    return res.status(400).json({ error: { message: 'Invalid offer id' } })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await updateOfferStatusTx(client, offerId, status, req.user, reason)
    if (!result.ok) {
      await client.query('ROLLBACK'); client.release()
      return res.status(result.code || 400).json({ error: { message: result.message, allowed: result.allowed || null } })
    }
    await client.query('COMMIT'); client.release()
    return res.json({ ok: true, offer: result.offer })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    client.release()
    console.error('Offer status update error:', error)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Get offer history
router.get('/offers/:id/history', authMiddleware, async (req, res) => {
  const offerId = parseInt(req.params.id, 10)
  if (!Number.isFinite(offerId)) return res.status(400).json({ error: { message: 'Invalid offer id' } })

  try {
    const history = await pool.query(`
      SELECT 
        oh.created_at,
        oh.action,
        oh.notes,
        u.email as user_name,
        u.role as user_role
      FROM offer_history oh
      JOIN users u ON u.id = oh.user_id
      WHERE oh.offer_id = $1
      ORDER BY oh.created_at DESC
    `, [offerId])
    
    return res.json({ ok: true, history: history.rows })
  } catch (error) {
    console.error('Offer history error:', error)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Bulk offer actions
router.post('/offers/bulk-action', authMiddleware, requireRole(['sales_manager', 'financial_manager', 'superadmin']), async (req, res) => {
  const { offerIds, action, reason } = req.body || {}
  if (!Array.isArray(offerIds) || offerIds.length === 0) {
    return res.status(400).json({ error: { message: 'offerIds must be a non-empty array' } })
  }
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ error: { message: 'action is required' } })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let updated = 0
    for (const oid of offerIds) {
      const id = Number(oid)
      if (!Number.isFinite(id)) continue
      const result = await updateOfferStatusTx(client, id, action, req.user, reason)
      if (result.ok) updated += 1
    }
    await client.query('COMMIT'); client.release()
    return res.json({ ok: true, updated, total: offerIds.length })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    client.release()
    console.error('Bulk action error:', error)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export default router