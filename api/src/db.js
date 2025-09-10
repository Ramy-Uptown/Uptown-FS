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
      unit_type TEXT,
      sales_rep_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'draft', -- draft | pending_approval | approved | rejected
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Ensure unit_type and sales_rep_id exist (for older deployments)
    DO $
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='deals' AND column_name='unit_type'
      ) THEN
        ALTER TABLE deals ADD COLUMN unit_type TEXT;
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='deals' AND column_name='sales_rep_id'
      ) THEN
        ALTER TABLE deals ADD COLUMN sales_rep_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END;
    $;

    CREATE TABLE IF NOT EXISTS deal_history (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      action TEXT NOT NULL, -- create | submit | approve | reject | modify
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Sales commissions module
    CREATE TABLE IF NOT EXISTS sales_people (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT DEFAULT 'sales',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS commission_policies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rules JSONB NOT NULL DEFAULT '{}'::jsonb, -- flexible rules
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS deal_commissions (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      sales_person_id INTEGER NOT NULL REFERENCES sales_people(id) ON DELETE SET NULL,
      policy_id INTEGER REFERENCES commission_policies(id) ON DELETE SET NULL,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Units catalog
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      unit_type TEXT,
      base_price NUMERIC(18,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EGP',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_units'
      ) THEN
        CREATE TRIGGER set_timestamp_units
        BEFORE UPDATE ON units
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_sales_people'
      ) THEN
        CREATE TRIGGER set_timestamp_sales_people
        BEFORE UPDATE ON sales_people
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_commission_policies'
      ) THEN
        CREATE TRIGGER set_timestamp_commission_policies
        BEFORE UPDATE ON commission_policies
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_deal_commissions'
      ) THEN
        CREATE TRIGGER set_timestamp_deal_commissions
        BEFORE UPDATE ON deal_commissions
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