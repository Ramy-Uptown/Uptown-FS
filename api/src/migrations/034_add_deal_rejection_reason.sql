-- Add explicit rejection_reason to deals for visible feedback
ALTER TABLE IF EXISTS deals
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;