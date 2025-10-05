import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'
import crypto from 'crypto'

async function createEmergencySuperAdmin() {
  const email = 'emergency.superadmin@system.local'
  const password = crypto.randomBytes(12).toString('hex')
  const hash = await bcrypt.hash(password, 12)

  await pool.query(`
    INSERT INTO users (email, password_hash, role, active) 
    VALUES ($1, $2, 'superadmin', true)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = $2, active = true
  `, [email, hash])

  console.log('=== EMERGENCY SUPERVISOR ACCESS ===')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
  console.log('=====================================')
  console.log('SAVE THIS INFORMATION IMMEDIATELY!')
  console.log('Remove this account after creating proper admin')
}

createEmergencySuperAdmin().then(() => process.exit(0))