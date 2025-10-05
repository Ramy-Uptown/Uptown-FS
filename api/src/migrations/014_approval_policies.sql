-- create only the table; triggers & data will be added later
CREATE TABLE IF NOT EXISTS approval_policies (
  id SERIAL PRIMARY KEY,
  scope_type TEXT NOT NULL DEFAULT 'global',
  scope_id INTEGER,
  policy_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  min_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 2.01,
  max_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  target_npv_tolerance_percent NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);