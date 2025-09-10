import pg from 'pg'
import bcrypt from 'bcryptjs'

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_USER = 'appuser',
  DB_PASSWORD = 'apppass',
  DB_NAME = 'appdb',
  ADMIN_EMAIL = 'admin@example.com',
  ADMIN_PASSWORD = 'admin123456'
} = process.env

export const pool = new pg.Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: 10
})

export async function initDb() {
  // Schema setup
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS deals (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      details JSONB DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft', -- draft | pending_approval | approved | rejected
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS deal_history (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      action TEXT NOT NULL, -- create | submit | approve | reject | modify
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $ LANGUAGE plpgsql;

    DO $
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_users'
      ) THEN
        CREATE TRIGGER set_timestamp_users
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_deals'
      ) THEN
        CREATE TRIGGER set_timestamp_deals
        BEFORE UPDATE ON deals
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
      END IF;
    END;
    $;
  `)

  // Seed initial admin if table empty
  const count = await pool.query('SELECT COUNT(*)::int AS c FROM users')
  if ((count.rows[0]?.c || 0) === 0) {
    const email = String(ADMIN_EMAIL || '').trim().toLowerCase()
    const pass = String(ADMIN_PASSWORD || 'admin123456')
    const hash = await bcrypt.hash(pass, 10)
    await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
      [email || 'admin@example.com', hash, 'admin']
    )
    console.log(`Seeded initial admin user: ${email || 'admin@example.com'}`)
  }
}