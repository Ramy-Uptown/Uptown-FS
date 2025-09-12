import express from 'express';
import { pool } from './db.js';
import { authMiddleware, requireRole } from './authRoutes.js';

const router = express.Router();

// Middleware to ensure authentication for all pricing routes
router.use(authMiddleware);

// Create a new standard pricing (Financial Manager only)
router.post('/standard', requireRole(['financial_manager']), async (req, res) => {
  try {
    const { unit_id, price } = req.body;
    const created_by = req.user.id;

    if (!unit_id || !price) {
      return res.status(400).json({ error: { message: 'unit_id and price are required' } });
    }

    const result = await pool.query(
      'INSERT INTO standard_pricing (unit_id, price, created_by) VALUES ($1, $2, $3) RETURNING *',
      [unit_id, price, created_by]
    );

    res.status(201).json({ ok: true, pricing: result.rows[0] });
  } catch (e) {
    console.error('POST /api/pricing/standard error:', e);
    res.status(500).json({ error: { message: 'Internal error' } });
  }
});

// Update the status of a standard pricing (CEO only)
router.put('/standard/:id/status', requireRole(['ceo']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const approved_by = req.user.id;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: { message: 'status must be "approved" or "rejected"' } });
    }

    const result = await pool.query(
      'UPDATE standard_pricing SET status = $1, approved_by = $2 WHERE id = $3 RETURNING *',
      [status, approved_by, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Pricing not found' } });
    }

    res.json({ ok: true, pricing: result.rows[0] });
  } catch (e) {
    console.error('PUT /api/pricing/standard/:id/status error:', e);
    res.status(500).json({ error: { message: 'Internal error' } });
  }
});

// Get all standard pricings (Financial Manager and CEO)
router.get('/standard', requireRole(['financial_manager', 'ceo']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        sp.*,
        u.code AS unit_code,
        u.description AS unit_description,
        creator.email AS created_by_email,
        approver.email AS approved_by_email
      FROM standard_pricing sp
      JOIN units u ON sp.unit_id = u.id
      JOIN users creator ON sp.created_by = creator.id
      LEFT JOIN users approver ON sp.approved_by = approver.id
      ORDER BY sp.created_at DESC
    `);

    res.json({ ok: true, pricings: result.rows });
  } catch (e) {
    console.error('GET /api/pricing/standard error:', e);
    res.status(500).json({ error: { message: 'Internal error' } });
  }
});

export default router;
