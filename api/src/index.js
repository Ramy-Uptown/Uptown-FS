import app from './app.js'
import { initDb, pool } from './db.js'
import { runMigrations } from './migrate.js'

const PORT = process.env.PORT || 3000

async function cleanupExpiredTokens() {
  try {
    await pool.query("DELETE FROM refresh_tokens WHERE expires_at < NOW()")
    await pool.query("DELETE FROM password_reset_tokens WHERE (expires_at < NOW()) OR used = TRUE")
  } catch (e) {
    console.error('Token cleanup error:', e)
  }
}

async function start() {
  try {
    await initDb()
    await runMigrations()
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API listening on http://0.0.0.0:${PORT}`)
    })

    // Schedule periodic cleanup (every hour). First run after startup.
    const intervalMs = Number(process.env.TOKEN_CLEANUP_INTERVAL_MS || 60 * 60 * 1000)
    setTimeout(cleanupExpiredTokens, 10_000)
    setInterval(cleanupExpiredTokens, intervalMs)
  } catch (e) {
    console.error('Failed to initialize DB:', e)
    process.exit(1)
  }
}

start()