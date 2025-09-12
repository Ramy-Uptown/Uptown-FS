-- Add active flag to users for deactivation support
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill existing rows to active=true (default already ensures this)
UPDATE users SET active = TRUE WHERE active IS NULL;