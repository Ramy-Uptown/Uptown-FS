import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { pool } from './db.js'

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export async function runMigrations() {
  // Ensure migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      hash TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)

  const migrationsDir = path.join(process.cwd(), 'api', 'src', 'migrations')
  if (!fs.existsSync(migrationsDir)) {
    // Nothing to do
    return
  }

  // Load already applied migrations
  const applied = await pool.query('SELECT filename, hash FROM schema_migrations')
  const appliedMap = new Map(applied.rows.map(r => [r.filename, r.hash]))

  // Read .sql files and sort by name
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.toLowerCase().endsWith('.sql'))
    .sort()

  for (const file of files) {
    const filepath = path.join(migrationsDir, file)
    const sql = fs.readFileSync(filepath, 'utf8')
    const hash = sha256(sql)

    // Skip if same filename and same hash already applied
    const prevHash = appliedMap.get(file)
    if (prevHash && prevHash === hash) {
      continue
    }

    // If filename exists with different hash, we do not auto-reapply to avoid drift
    if (prevHash && prevHash !== hash) {
      console.warn(`[migrations] Skipping changed migration ${file} (hash mismatch). Create a new migration instead.`)
      continue
    }

    console.log(`[migrations] Applying ${file}...`)
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO schema_migrations (filename, hash) VALUES ($1, $2)', [file, hash])
      console.log(`[migrations] Applied ${file}`)
    } catch (e) {
      console.error(`[migrations] Failed to apply ${file}:`, e)
      throw e
    }
  }
}