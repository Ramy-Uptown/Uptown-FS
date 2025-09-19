import express from 'express';
import { pool } from './db.js';
import { authMiddleware, requireRole } from './authRoutes.js';

const router = express.Router();

// Middleware to ensure authentication for all pricing routes
router.use(authMiddleware);

/**
 * Unit Model Pricing
 * One pricing row per model_id (unique). FM can create or update price which will be pending_approval.
 * Top-Management (ceo, chairman, vice_chairman) can approve or reject.
 */

// Upsert pricing for a unit model (FM)
router.post('/unit-model', requireRole(['financial_manager']), async (req, res) => {
  try {
    const { model_id, price } = req.body || {};
    if (!model_id || !Number.isFinite(Number(price))) {
      return res.status(400).json({ error: { message: 'model_id and numeric price are required' } });
    }
    const pid = Number(model_id);
    const pr = Number(price);
    // Upsert behavior: if exists -> update price and set status pending_approval; else insert new
    const existing = await pool.query('SELECT * FROM unit_model_pricing WHERE model_id=$1', [pid]);
    let out;
    if (existing.rows.length > 0) {
      const r = await pool.query(
        `UPDATE unit_model_pricing
         SET price=$1, status='pending_approval', approved_by=NULL, updated_at=now()
         WHERE model_id=$2
         RETURNING *`,
        [pr, pid]
      );
      out = r.rows[0];
    } else {
      const r = await pool.query(
        `INSERT INTO unit_model_pricing (model_id, price, status, created_by)
         VALUES ($1, $2, 'pending_approval', $3)
         RETURNING *`,
        [pid, pr, req.user.id]
      );
      out = r.rows[0];
    }
    return res.status(201).json({ ok: true, pricing: out });
  } catch (e) {
    console.error('POST /api/pricing/unit-model error:', e);
    res.status(500).json({ error: { message: 'Internal error' } });
  }
});

// Approve/reject (Top Management)
router.patch('/unit-model/:id/status', requireRole(['ceo','chairman','vice_chairman']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!id) return res.status(400).json({ error: { message: 'Invalid id' } });
    if (!status || !['approved', 'rejected'].includes(String(status))) {
      return res.status(400).json({ error: { message: 'status must be \"approved\" or \"rejected\"' } });
    }
    const r = await pool.query(
      `UPDATE unit_model_pricing SET status=$1, approved_by=$2, updated_at=now() WHERE id=$3 RETURNING *`,
      [String(status), req.user.id, id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: { message: 'Not found' } });
    return res.json({ ok: true, pricing: r.rows[0] });
  } catch (e) {
    console.error('PATCH /api/pricing/unit-model/:id/status error:', e);
    res.status(500).json({ error: { message: 'Internal error' } });
  }
});

// List pricing (FM + Top Management)
router.get('/unit-model', requireRole(['financial_manager','ceo','chairman','vice_chairman']), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT
         p.*,
         m.model_name,
         m.model_code,
         m.area,
         m.orientation,
         creator.email AS created_by_email,
         approver.email AS approved_by_email
       FROM unit_model_pricing p
       JOIN unit_models m ON m.id = p.model_id
       LEFT JOIN users creator ON creator.id = p.created_by
       LEFT JOIN users approver ON approver.id = p.approved_by
       ORDER BY p.updated_at DESC`
    );
    return res.json({ ok: true, pricings: r.rows });
  } catch (e) {
    console.error('GET /api/pricing/unit-model error:', e);
    res.status(500).json({ error: { message: 'Internal error' } });
  }
});

export default router;
