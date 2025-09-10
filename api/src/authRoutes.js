import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from './db.js'

const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || 'devsecretchange'
const TOKEN_EXPIRES_IN = '7d'

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: { message: 'Unauthorized' } })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: { message: 'Invalid token' } })
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: { message: 'Forbidden' } })
  next()
}

// Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body || {}
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: { message: 'Email is required' } })
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: { message: 'Password must be at least 6 characters' } })
    }
    const normalizedEmail = email.trim().toLowerCase()

    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [normalizedEmail])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'Email already registered' } })
    }
    const hash = await bcrypt.hash(password, 10)
    const userRole = role && typeof role === 'string' ? role : 'user'
    const insert = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [normalizedEmail, hash, userRole]
    )
    const user = insert.rows[0]
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN })
    return res.json({ ok: true, user, token })
  } catch (e) {
    console.error('POST /api/auth/register error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: { message: 'Email and password are required' } })
    const normalizedEmail = String(email).trim().toLowerCase()
    const result = await pool.query('SELECT id, email, password_hash, role FROM users WHERE email=$1', [normalizedEmail])
    if (result.rows.length === 0) return res.status(401).json({ error: { message: 'Invalid credentials' } })
    const user = result.rows[0]
    const ok = await bcrypt.compare(String(password), user.password_hash)
    if (!ok) return res.status(401).json({ error: { message: 'Invalid credentials' } })
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN })
    return res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role }, token })
  } catch (e) {
    console.error('POST /api/auth/login error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, role FROM users WHERE id=$1', [req.user.id])
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'User not found' } })
    return res.json({ ok: true, user: result.rows[0] })
  } catch (e) {
    console.error('GET /api/auth/me error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// User management (admin)
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, role, created_at, updated_at FROM users ORDER BY id ASC')
    return res.json({ ok: true, users: result.rows })
  } catch (e) {
    console.error('GET /api/auth/users error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

router.patch('/users/:id/role', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { role } = req.body || {}
    const id = Number(req.params.id)
    if (!role || typeof role !== 'string') return res.status(400).json({ error: { message: 'role is required' } })
    const result = await pool.query('UPDATE users SET role=$1 WHERE id=$2 RETURNING id, email, role', [role, id])
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'User not found' } })
    return res.json({ ok: true, user: result.rows[0] })
  } catch (e) {
    console.error('PATCH /api/auth/users/:id/role error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const result = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id', [id])
    if (result.rows.length === 0) return res.status(404).json({ error: { message: 'User not found' } })
    return res.json({ ok: true, id })
  } catch (e) {
    console.error('DELETE /api/auth/users/:id error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

export { authMiddleware, adminOnly }
export default router