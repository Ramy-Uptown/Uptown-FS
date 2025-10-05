-- Versioning and acceptance tracking for payment plans (proposals)
ALTER TABLE IF EXISTS payment_plans
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_id INTEGER REFERENCES payment_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Only one accepted plan per deal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_payment_plans_one_accepted_per_deal'
  ) THEN
    CREATE UNIQUE INDEX uniq_payment_plans_one_accepted_per_deal
      ON payment_plans(deal_id)
      WHERE accepted = TRUE;
  END IF;
END;
$$;