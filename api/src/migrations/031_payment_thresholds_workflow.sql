-- Workflow for payment thresholds: proposals and approvals

CREATE TABLE IF NOT EXISTS payment_threshold_proposals (
  id SERIAL PRIMARY KEY,
  first_year_percent_min NUMERIC(7,3),
  first_year_percent_max NUMERIC(7,3),
  second_year_percent_min NUMERIC(7,3),
  second_year_percent_max NUMERIC(7,3),
  handover_percent_min NUMERIC(7,3),
  handover_percent_max NUMERIC(7,3),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  proposed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_payment_threshold_proposals'
  ) THEN
    CREATE TRIGGER set_timestamp_payment_threshold_proposals
    BEFORE UPDATE ON payment_threshold_proposals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;

-- Indexes to speed up queries
CREATE INDEX IF NOT EXISTS idx_payment_threshold_proposals_status ON payment_threshold_proposals(status);
CREATE INDEX IF NOT EXISTS idx_payment_threshold_proposals_proposed_by ON payment_threshold_proposals(proposed_by);