-- Add optional profile fields to users
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

