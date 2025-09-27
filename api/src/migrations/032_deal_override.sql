-- Add override workflow fields to deals

ALTER TABLE IF EXISTS deals
  ADD COLUMN IF NOT EXISTS needs_override BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS override_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS override_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS override_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS override_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS override_notes TEXT;

-- Optional acceptability flags for reporting (not enforced automatically)
ALTER TABLE IF EXISTS deals
  ADD COLUMN IF NOT EXISTS acceptable_pv BOOLEAN,
  ADD COLUMN IF NOT EXISTS acceptable_first_year BOOLEAN,
  ADD COLUMN IF NOT EXISTS acceptable_second_year BOOLEAN,
  ADD COLUMN IF NOT EXISTS acceptable_handover BOOLEAN;