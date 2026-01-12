import express from 'express'
import { pool } from './db.js'
import { authMiddleware, requireRole } from './authRoutes.js'
import { bad, ok, ensureNumber } from './workflowUtils.js'

const router = express.Router()

/**
 * SECTION: Team assignments (Sales / Finance / Contracts)
 * Mounted under /api/workflow
 */

function parseActiveFilter(value) {
  if (value === undefined) return null
  const v = String(value).toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return null
}

// SALES TEAMS

router.get(
  '/sales-teams/members',
  authMiddleware,
  requireRole(['sales_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const rows = await pool.query(
        `SELECT
           stm.id,
           stm.manager_user_id,
           stm.consultant_user_id,
           stm.active,
           stm.created_at,
           manager.email AS manager_email,
           consultant.email AS consultant_email
         FROM sales_team_members stm
         JOIN users manager ON manager.id = stm.manager_user_id
         JOIN users consultant ON consultant.id = stm.consultant_user_id
         ORDER BY stm.id DESC`
      )
      return ok(res, { members: rows.rows })
    } catch (e) {
      console.error('GET /api/workflow/sales-teams/members error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.post(
  '/sales-teams/members',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, consultant_user_id, active } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const cid = ensureNumber(consultant_user_id)
      if (!mid || !cid) {
        return bad(res, 400, 'manager_user_id and consultant_user_id are required')
      }
      const act = active == null ? true : !!active
      const ins = await pool.query(
        `INSERT INTO sales_team_members (manager_user_id, consultant_user_id, active)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [mid, cid, act]
      )
      return ok(res, { member: ins.rows[0] })
    } catch (e) {
      console.error('POST /api/workflow/sales-teams/members error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/sales-teams/members/:id',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')
      const { active } = req.body || {}
      const act = active == null ? null : !!active
      if (act == null) {
        return bad(res, 400, 'active is required')
      }
      const upd = await pool.query(
        `UPDATE sales_team_members
         SET active=$1, updated_at=now()
         WHERE id=$2
         RETURNING *`,
        [act, id]
      )
      if (upd.rows.length === 0) return bad(res, 404, 'Not found')
      return ok(res, { member: upd.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/sales-teams/members/:id error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.get(
  '/sales-teams/memberships',
  authMiddleware,
  requireRole(['sales_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const { active, consultant_user_id } = req.query || {}
      const params = []
      const where = []

      const activeFlag = parseActiveFilter(active)
      if (activeFlag !== null) {
        params.push(activeFlag)
        where.push(`stm.active = ${params.length}`)
      }

      if (consultant_user_id) {
        const cid = ensureNumber(consultant_user_id)
        if (!cid) {
          return bad(res, 400, 'Invalid consultant_user_id')
        }
        params.push(cid)
        where.push(`stm.consultant_user_id = ${params.length}`)
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const result = await pool.query(
        `SELECT
           stm.id,
           stm.manager_user_id,
           stm.consultant_user_id,
           stm.consultant_user_id AS member_user_id,
           stm.active,
           stm.created_at,
           manager.email AS manager_email,
           consultant.email AS consultant_email,
           consultant.email AS member_email
         FROM sales_team_members stm
         JOIN users manager ON manager.id = stm.manager_user_id
         JOIN users consultant ON consultant.id = stm.consultant_user_id
         ${whereSql}
         ORDER BY stm.id DESC`,
        params
      )

      return ok(res, { memberships: result.rows })
    } catch (e) {
      console.error('GET /api/workflow/sales-teams/memberships error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.post(
  '/sales-teams/assign',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, consultant_user_id } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const cid = ensureNumber(consultant_user_id)
      if (!mid || !cid) {
        return bad(res, 400, 'manager_user_id and consultant_user_id are required')
      }

      const existing = await pool.query(
        `SELECT id
         FROM sales_team_members
         WHERE manager_user_id = $1 AND consultant_user_id = $2
         ORDER BY id DESC
         LIMIT 1`,
        [mid, cid]
      )

      let row
      if (existing.rows.length) {
        const upd = await pool.query(
          `UPDATE sales_team_members
           SET active = true, updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [existing.rows[0].id]
        )
        row = upd.rows[0]
      } else {
        const ins = await pool.query(
          `INSERT INTO sales_team_members (manager_user_id, consultant_user_id, active)
           VALUES ($1, $2, true)
           RETURNING *`,
          [mid, cid]
        )
        row = ins.rows[0]
      }

      return ok(res, { membership: row })
    } catch (e) {
      console.error('POST /api/workflow/sales-teams/assign error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/sales-teams/assign',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, consultant_user_id, active } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const cid = ensureNumber(consultant_user_id)
      const act = active == null ? null : !!active

      if (!mid || !cid) {
        return bad(res, 400, 'manager_user_id and consultant_user_id are required')
      }
      if (act == null) {
        return bad(res, 400, 'active is required')
      }

      const existing = await pool.query(
        `SELECT id
         FROM sales_team_members
         WHERE manager_user_id = $1 AND consultant_user_id = $2
         ORDER BY id DESC
         LIMIT 1`,
        [mid, cid]
      )
      if (existing.rows.length === 0) {
        return bad(res, 404, 'Membership not found')
      }

      const upd = await pool.query(
        `UPDATE sales_team_members
         SET active = $1, updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [act, existing.rows[0].id]
      )

      return ok(res, { membership: upd.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/sales-teams/assign error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// FINANCE TEAMS

router.get(
  '/finance-teams/members',
  authMiddleware,
  requireRole(['financial_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const rows = await pool.query(
        `SELECT
           ftm.id,
           ftm.manager_user_id,
           ftm.member_user_id,
           ftm.active,
           ftm.created_at,
           manager.email AS manager_email,
           member.email AS member_email
         FROM finance_team_members ftm
         JOIN users manager ON manager.id = ftm.manager_user_id
         JOIN users member ON member.id = ftm.member_user_id
         ORDER BY ftm.id DESC`
      )
      return ok(res, { members: rows.rows })
    } catch (e) {
      console.error('GET /api/workflow/finance-teams/members error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.post(
  '/finance-teams/members',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, member_user_id, active } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const mem = ensureNumber(member_user_id)
      if (!mid || !mem) {
        return bad(res, 400, 'manager_user_id and member_user_id are required')
      }
      const act = active == null ? true : !!active
      const ins = await pool.query(
        `INSERT INTO finance_team_members (manager_user_id, member_user_id, active)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [mid, mem, act]
      )
      return ok(res, { member: ins.rows[0] })
    } catch (e) {
      console.error('POST /api/workflow/finance-teams/members error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/finance-teams/members/:id',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')
      const { active } = req.body || {}
      const act = active == null ? null : !!active
      if (act == null) {
        return bad(res, 400, 'active is required')
      }
      const upd = await pool.query(
        `UPDATE finance_team_members
         SET active=$1, updated_at=now()
         WHERE id=$2
         RETURNING *`,
        [act, id]
      )
      if (upd.rows.length === 0) return bad(res, 404, 'Not found')
      return ok(res, { member: upd.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/finance-teams/members/:id error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.get(
  '/finance-teams/memberships',
  authMiddleware,
  requireRole(['financial_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const { active } = req.query || {}
      const params = []
      const where = []

      const activeFlag = parseActiveFilter(active)
      if (activeFlag !== null) {
        params.push(activeFlag)
        where.push(`ftm.active = $${params.length}`)

}

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const result = await pool.query(
        `SELECT
           ftm.id,
           ftm.manager_user_id,
           ftm.member_user_id,
           ftm.active,
           ftm.created_at,
           manager.email AS manager_email,
           member.email AS member_email
         FROM finance_team_members ftm
         JOIN users manager ON manager.id = ftm.manager_user_id
         JOIN users member ON member.id = ftm.member_user_id
         ${whereSql}
         ORDER BY ftm.id DESC`,
        params
      )

      return ok(res, { memberships: result.rows })
    } catch (e) {
      console.error('GET /api/workflow/finance-teams/memberships error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.post(
  '/finance-teams/assign',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, member_user_id } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const mem = ensureNumber(member_user_id)
      if (!mid || !mem) {
        return bad(res, 400, 'manager_user_id and member_user_id are required')
      }

      const existing = await pool.query(
        `SELECT id
         FROM finance_team_members
         WHERE manager_user_id = $1 AND member_user_id = $2
         ORDER BY id DESC
         LIMIT 1`,
        [mid, mem]
      )

      let row
      if (existing.rows.length) {
        const upd = await pool.query(
          `UPDATE finance_team_members
           SET active = true, updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [existing.rows[0].id]
        )
        row = upd.rows[0]
      } else {
        const ins = await pool.query(
          `INSERT INTO finance_team_members (manager_user_id, member_user_id, active)
           VALUES ($1, $2, true)
           RETURNING *`,
          [mid, mem]
        )
        row = ins.rows[0]
      }

      return ok(res, { membership: row })
    } catch (e) {
      console.error('POST /api/workflow/finance-teams/assign error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/finance-teams/assign',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, member_user_id, active } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const mem = ensureNumber(member_user_id)
      const act = active == null ? null : !!active

      if (!mid || !mem) {
        return bad(res, 400, 'manager_user_id and member_user_id are required')
      }
      if (act == null) {
        return bad(res, 400, 'active is required')
      }

      const existing = await pool.query(
        `SELECT id
         FROM finance_team_members
         WHERE manager_user_id = $1 AND member_user_id = $2
         ORDER BY id DESC
         LIMIT 1`,
        [mid, mem]
      )
      if (existing.rows.length === 0) {
        return bad(res, 404, 'Membership not found')
      }

      const upd = await pool.query(
        `UPDATE finance_team_members
         SET active = $1, updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [act, existing.rows[0].id]
      )

      return ok(res, { membership: upd.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/finance-teams/assign error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

// CONTRACTS TEAMS

router.get(
  '/contracts-teams/members',
  authMiddleware,
  requireRole(['contract_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const rows = await pool.query(
        `SELECT
           ctm.id,
           ctm.manager_user_id,
           ctm.member_user_id,
           ctm.active,
           ctm.created_at,
           manager.email AS manager_email,
           member.email AS member_email
         FROM contracts_team_members ctm
         JOIN users manager ON manager.id = ctm.manager_user_id
         JOIN users member ON member.id = ctm.member_user_id
         ORDER BY ctm.id DESC`
      )
      return ok(res, { members: rows.rows })
    } catch (e) {
      console.error('GET /api/workflow/contracts-teams/members error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.post(
  '/contracts-teams/members',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, member_user_id, active } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const mem = ensureNumber(member_user_id)
      if (!mid || !mem) {
        return bad(res, 400, 'manager_user_id and member_user_id are required')
      }
      const act = active == null ? true : !!active
      const ins = await pool.query(
        `INSERT INTO contracts_team_members (manager_user_id, member_user_id, active)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [mid, mem, act]
      )
      return ok(res, { member: ins.rows[0] })
    } catch (e) {
      console.error('POST /api/workflow/contracts-teams/members error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/contracts-teams/members/:id',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const id = ensureNumber(req.params.id)
      if (!id) return bad(res, 400, 'Invalid id')
      const { active } = req.body || {}
      const act = active == null ? null : !!active
      if (act == null) {
        return bad(res, 400, 'active is required')
      }
      const upd = await pool.query(
        `UPDATE contracts_team_members
         SET active=$1, updated_at=now()
         WHERE id=$2
         RETURNING *`,
        [act, id]
      )
      if (upd.rows.length === 0) return bad(res, 404, 'Not found')
      return ok(res, { member: upd.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/contracts-teams/members/:id error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.get(
  '/contracts-teams/memberships',
  authMiddleware,
  requireRole(['contract_manager', 'admin', 'superadmin']),
  async (req, res) => {
    try {
      const { active } = req.query || {}
      const params = []
      const where = []

      const activeFlag = parseActiveFilter(active)
      if (activeFlag !== null) {
        params.push(activeFlag)
        where.push(`ctm.active = ${params.length}`)
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const result = await pool.query(
        `SELECT
           ctm.id,
           ctm.manager_user_id,
           ctm.member_user_id,
           ctm.active,
           ctm.created_at,
           manager.email AS manager_email,
           member.email AS member_email
         FROM contracts_team_members ctm
         JOIN users manager ON manager.id = ctm.manager_user_id
         JOIN users member ON member.id = ctm.member_user_id
         ${whereSql}
         ORDER BY ctm.id DESC`,
        params
      )

      return ok(res, { memberships: result.rows })
    } catch (e) {
      console.error('GET /api/workflow/contracts-teams/memberships error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.post(
  '/contracts-teams/assign',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, member_user_id } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const mem = ensureNumber(member_user_id)
      if (!mid || !mem) {
        return bad(res, 400, 'manager_user_id and member_user_id are required')
      }

      const existing = await pool.query(
        `SELECT id
         FROM contracts_team_members
         WHERE manager_user_id = $1 AND member_user_id = $2
         ORDER BY id DESC
         LIMIT 1`,
        [mid, mem]
      )

      let row
      if (existing.rows.length) {
        const upd = await pool.query(
          `UPDATE contracts_team_members
           SET active = true, updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [existing.rows[0].id]
        )
        row = upd.rows[0]
      } else {
        const ins = await pool.query(
          `INSERT INTO contracts_team_members (manager_user_id, member_user_id, active)
           VALUES ($1, $2, true)
           RETURNING *`,
          [mid, mem]
        )
        row = ins.rows[0]
      }

      return ok(res, { membership: row })
    } catch (e) {
      console.error('POST /api/workflow/contracts-teams/assign error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

router.patch(
  '/contracts-teams/assign',
  authMiddleware,
  requireRole(['superadmin']),
  async (req, res) => {
    try {
      const { manager_user_id, member_user_id, active } = req.body || {}
      const mid = ensureNumber(manager_user_id)
      const mem = ensureNumber(member_user_id)
      const act = active == null ? null : !!active

      if (!mid || !mem) {
        return bad(res, 400, 'manager_user_id and member_user_id are required')
      }
      if (act == null) {
        return bad(res, 400, 'active is required')
      }

      const existing = await pool.query(
        `SELECT id
         FROM contracts_team_members
         WHERE manager_user_id = $1 AND member_user_id = $2
         ORDER BY id DESC
         LIMIT 1`,
        [mid, mem]
      )
      if (existing.rows.length === 0) {
        return bad(res, 404, 'Membership not found')
      }

      const upd = await pool.query(
        `UPDATE contracts_team_members
         SET active = $1, updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [act, existing.rows[0].id]
      )

      return ok(res, { membership: upd.rows[0] })
    } catch (e) {
      console.error('PATCH /api/workflow/contracts-teams/assign error:', e)
      return bad(res, 500, 'Internal error')
    }
  }
)

export default router