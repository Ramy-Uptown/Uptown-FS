import express from 'express'
import { pool } from './db.js'
import { authMiddleware, requireRole } from './authRoutes.js'

const router = express.Router()

// Get all roles and permissions
router.get('/roles', authMiddleware, requireRole(['superadmin']), async (req, res) => {
  const roles = await pool.query(`
    SELECT role, COUNT(*) as user_count 
    FROM users 
    GROUP BY role 
    ORDER BY role
  `)
  res.json({ ok: true, roles: roles.rows })
})

// Promote user to any role
router.patch('/users/:id/promote', authMiddleware, requireRole(['superadmin']), async (req, res) => {
  const { role } = req.body
  const userId = parseInt(req.params.id)

  const validRoles = ['user', 'admin', 'superadmin', 'manager', 'sales_manager', 'property_consultant', 'financial_admin', 'financial_manager', 'contract_person', 'contract_manager', 'chairman', 'vice_chairman', 'ceo']

  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: { message: 'Invalid role' } })
  }

  const result = await pool.query(
    'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role',
    [role, userId]
  )

  if (result.rows.length === 0) {
    return res.status(404).json({ error: { message: 'User not found' } })
  }

  res.json({ ok: true, user: result.rows[0] })
})

// Bulk role assignment
router.post('/roles/bulk-assign', authMiddleware, requireRole(['superadmin']), async (req, res) => {
  const { userIds, newRole } = req.body

  const result = await pool.query(
    'UPDATE users SET role = $1, updated_at = NOW() WHERE id = ANY($2) RETURNING id, email, role',
    [newRole, userIds]
  )

  res.json({ ok: true, updated: result.rows })
})

export default router