-- Discount approval policies

CREATE TABLE IF NOT EXISTS approval_policies (
  id SERIAL PRIMARY KEY,
  scope_type TEXT NOT NULL DEFAULT 'global', -- global | project | unit_type
  scope_id INTEGER,                          -- nullable for global
  policy_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  min_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 2.01,
  max_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  target_npv_tolerance_percent NUMERIC(5,2) NOT NULL DEFAULT 70.00, -- 70-100%
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_approval_policies') THEN
    CREATE TRIGGER set_timestamp_approval_policies
    BEFORE UPDATE ON approval_policies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;


-- Ensure a single active global policy exists (default 5%)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM approval_policies WHERE scope_type='global' AND active=TRUE
  ) THEN
    INSERT INTO approval_policies (scope_type, scope_id, policy_limit_percent, min_limit_percent, max_limit_percent, target_npv_tolerance_percent, active, notes)
    VALUES ('global', NULL, 5.00, 2.01, 25.00, 70.00, TRUE, 'Default global discount policy');
  END IF;
END;

CREATE INDEX IF NOT EXISTS idx_approval_policies_scope ON approval_policies(scope_type, scope_id, active);