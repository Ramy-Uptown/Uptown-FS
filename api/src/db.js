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
  // Schema setup - COMPLETE VERSION
  await pool.query(`
    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Add/update a CHECK constraint on the user roles for data integrity
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
      'user',
      'admin',
      'superadmin',
      'manager',
      'sales_manager',
      'property_consultant',
      'financial_admin',
      'financial_manager',
      'contract_person',
      'contract_manager',
      'chairman',
      'vice_chairman',
      'ceo'
    ));

    -- Ensure optional profile columns exist (defensive against migration drift)
    ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

    -- Auth tokens
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

    -- Sales commissions module
    CREATE TABLE IF NOT EXISTS commission_policies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rules JSONB NOT NULL DEFAULT '{}'::jsonb,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

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

    -- Deals
    CREATE TABLE IF NOT EXISTS deals (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      details JSONB DEFAULT '{}'::jsonb,
      unit_type TEXT,
      sales_rep_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      policy_id INTEGER REFERENCES commission_policies(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- For older deployments ensure columns exist
    ALTER TABLE IF EXISTS deals
      ADD COLUMN IF NOT EXISTS unit_type TEXT;
    ALTER TABLE IF EXISTS deals
      ADD COLUMN IF NOT EXISTS sales_rep_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE IF EXISTS deals
      ADD COLUMN IF NOT EXISTS policy_id INTEGER REFERENCES commission_policies(id) ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS deal_history (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
      available BOOLEAN DEFAULT true,
      blocked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(50),
      nationality VARCHAR(100),
      id_number VARCHAR(100),
      id_type VARCHAR(50),
      address TEXT,
      date_of_birth DATE,
      occupation VARCHAR(255),
      company VARCHAR(255),
      active BOOLEAN DEFAULT true,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Offers (preliminary offers / quotations)
    CREATE TABLE IF NOT EXISTS offers (
      id SERIAL PRIMARY KEY,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      discount_percent NUMERIC(5,2) DEFAULT 0,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Offer history
    CREATE TABLE IF NOT EXISTS offer_history (
      id SERIAL PRIMARY KEY,
      offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
      action VARCHAR(50) NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      ref_table VARCHAR(50),
      ref_id INTEGER,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Blocks (unit blocking requests/approvals)
    CREATE TABLE IF NOT EXISTS blocks (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      duration_days INTEGER NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      blocked_until TIMESTAMPTZ NOT NULL,
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      approval_reason TEXT,
      rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      rejected_at TIMESTAMPTZ,
      rejection_reason TEXT,
      extension_count INTEGER DEFAULT 0,
      expiry_notified BOOLEAN DEFAULT false,
      last_extension_reason TEXT,
      last_extended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      last_extended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Approval policies for discount limits
    CREATE TABLE IF NOT EXISTS approval_policies (
      id SERIAL PRIMARY KEY,
      scope_type VARCHAR(50) NOT NULL DEFAULT 'global',
      scope_id INTEGER,
      policy_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Sales team assignments: map manager to consultants (many-to-many)
    CREATE TABLE IF NOT EXISTS sales_team_members (
      id SERIAL PRIMARY KEY,
      manager_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      consultant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (manager_user_id, consultant_user_id)
    );

    -- Contracts team assignments: contract_manager -> contract_person
    CREATE TABLE IF NOT EXISTS contracts_team_members (
      id SERIAL PRIMARY KEY,
      manager_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (manager_user_id, member_user_id)
    );

    -- Finance team assignments: financial_manager -> financial_admin
    CREATE TABLE IF NOT EXISTS finance_team_members (
      id SERIAL PRIMARY KEY,
      manager_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (manager_user_id, member_user_id)
    );

    -- Audit log for admin-initiated changes to users
    CREATE TABLE IF NOT EXISTS user_audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      details JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Trigger function
    CREATE OR REPLACE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create triggers if they don't already exist
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_users'
      ) THEN
        CREATE TRIGGER set_timestamp_users
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_deals'
      ) THEN
        CREATE TRIGGER set_timestamp_deals
        BEFORE UPDATE ON deals
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_units'
      ) THEN
        CREATE TRIGGER set_timestamp_units
        BEFORE UPDATE ON units
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_sales_people'
      ) THEN
        CREATE TRIGGER set_timestamp_sales_people
        BEFORE UPDATE ON sales_people
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_commission_policies'
      ) THEN
        CREATE TRIGGER set_timestamp_commission_policies
        BEFORE UPDATE ON commission_policies
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_deal_commissions'
      ) THEN
        CREATE TRIGGER set_timestamp_deal_commissions
        BEFORE UPDATE ON deal_commissions
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_customers'
      ) THEN
        CREATE TRIGGER set_timestamp_customers
        BEFORE UPDATE ON customers
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_offers'
      ) THEN
        CREATE TRIGGER set_timestamp_offers
        BEFORE UPDATE ON offers
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_blocks'
      ) THEN
        CREATE TRIGGER set_timestamp_blocks
        BEFORE UPDATE ON blocks
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_notifications'
      ) THEN
        CREATE TRIGGER set_timestamp_notifications
        BEFORE UPDATE ON notifications
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_approval_policies'
      ) THEN
        CREATE TRIGGER set_timestamp_approval_policies
        BEFORE UPDATE ON approval_policies
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_sales_team_members'
      ) THEN
        CREATE TRIGGER set_timestamp_sales_team_members
        BEFORE UPDATE ON sales_team_members
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_contracts_team_members'
      ) THEN
        CREATE TRIGGER set_timestamp_contracts_team_members
        BEFORE UPDATE ON contracts_team_members
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_finance_team_members'
      ) THEN
        CREATE TRIGGER set_timestamp_finance_team_members
        BEFORE UPDATE ON finance_team_members
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;
    END;
    $$;
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