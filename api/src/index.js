import app from './app.js'
import { initDb } from './db.js'

const PORT = process.env.PORT || 3000

async function start() {
  try {
    await initDb()
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API listening on http://0.0.0.0:${PORT}`)
    })
  } catch (e) {
    console.error('Failed to initialize DB:', e)
    process.exit(1)
  }
}

start()