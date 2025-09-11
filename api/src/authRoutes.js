import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { pool } from './db.js'

const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET || 'devsecretchange'
const ACCESS_EXPIRES_IN = '1h'
const REFRESH_TTL_DAYS = 30
const RESET_TTL_MINUTES = 60

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

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: { message: 'Forbidden' } })
    }
    next()
  }
}

const VALID_ROLES = [
  'user',
  'admin',
  'superadmin',
  'manager',
  'sales_manager',
  'property_consultant',
  'financial_manager',
  'financial_admin',
  'contract_manager',
  'contract_person',
  'chairman',
  'vice_chairman',
  'ceo'
]

function signAccessToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN })
}

async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
  await pool.query('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt])
  return { token, expiresAt }
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
    const accessToken = signAccessToken(user)
    const refresh = await issueRefreshToken(user.id)
    return res.json({ ok: true, user, accessToken, refreshToken: refresh.token })
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
    const accessToken = signAccessToken(user)
    const refresh = await issueRefreshToken(user.id)
    return res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role }, accessToken, refreshToken: refresh.token })
  } catch (e) {
    console.error('POST /api/auth/login error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Token refresh (rotate)
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {}
    if (!refreshToken) return res.status(400).json({ error: { message: 'refreshToken is required' } })
    const now = new Date()
    const result = await pool.query('SELECT user_id, expires_at FROM refresh_tokens WHERE token=$1', [refreshToken])
    if (result.rows.length === 0) return res.status(401).json({ error: { message: 'Invalid refresh token' } })
    const row = result.rows[0]
    if (new Date(row.expires_at) < now) {
      await pool.query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken])
      return res.status(401).json({ error: { message: 'Refresh token expired' } })
    }
    // Rotate
    await pool.query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken])
    const userRes = await pool.query('SELECT id, email, role FROM users WHERE id=$1', [row.user_id])
    if (userRes.rows.length === 0) return res.status(401).json({ error: { message: 'User not found' } })
    const user = userRes.rows[0]
    const accessToken = signAccessToken(user)
    const refresh = await issueRefreshToken(user.id)
    return res.json({ ok: true, accessToken, refreshToken: refresh.token })
  } catch (e) {
    console.error('POST /api/auth/refresh error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Logout (revoke refresh token)
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body || {}
    if (refreshToken) {
      await pool.query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken])
    }
    return res.json({ ok: true })
  } catch (e) {
    console.error('POST /api/auth/logout error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Password reset: request
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: { message: 'Email is required' } })
    const normalizedEmail = String(email).trim().toLowerCase()
    const result = await pool.query('SELECT id FROM users WHERE email=$1', [normalizedEmail])
    // Always respond ok to avoid user enumeration; but for dev, if found, include token
    if (result.rows.length === 0) {
      return res.json({ ok: true })
    }
    const userId = result.rows[0].id
    const token = crypto.randomBytes(48).toString('hex')
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)
    await pool.query(
      'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [token, userId, expiresAt]
    )
    // In production, send token via email. For development, log it to server console.
    console.log('[password reset] token for', normalizedEmail, token, 'expiresAt:', expiresAt.toISOString())
    return res.json({ ok: true })
  } catch (e) {
    console.error('POST /api/auth/request-password-reset error:', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
})

// Password reset: confirm
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {}
    if (!token || !newPassword) return res.status(400).json({ error: { message: 'token and newPassword are required' } })
    if (String(newPassword).length < 6) return res.status(400).json({ error: { message: 'Password must be at least 6 characters' } })
    const now = new Date()
    const result = await pool.query('SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token=$1', [token])
    if (result.rows.length === 0) return res.status(400).json({ error: { message: 'Invalid token' } })
    const row = result.rows[0]
    if (row.used) return res.status(400).json({ error: { message: 'Token already used' } })
    if (new Date(row.expires_at) < now) return res.status(400).json({ error: { message: 'Token expired' } })
    const hash = await bcrypt.hash(String(newPassword), 10)
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, row.user_id])
    await pool.query('UPDATE password_reset_tokens SET used=TRUE WHERE token=$1', [token])
    // Optional: invalidate refresh tokens for this user
    await pool.query('DELETE FROM refresh_tokens WHERE user_id=$1', [row.user_id])
    return res.json({ ok: true })
  } catch (e) {
    console.error('POST /api/auth/reset-password error:', e)
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
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: { message: 'Invalid role specified' } })
    }
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

export { authMiddleware, adminOnly, requireRole }
export default router