-- Add inventory metadata fields used for auto-population in offers
-- These are optional and can be filled by Financial Admin during inventory establishment.

ALTER TABLE IF EXISTS units
  ADD COLUMN IF NOT EXISTS unit_number TEXT,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS building_number TEXT,
  ADD COLUMN IF NOT EXISTS block_sector TEXT,
  ADD COLUMN IF NOT EXISTS zone TEXT,
  ADD COLUMN IF NOT EXISTS garden_details TEXT;

-- Indexes to aid filtering/search (safe to create if not exists)
CREATE INDEX IF NOT EXISTS idx_units_unit_number ON units((lower(COALESCE(unit_number, ''))));
CREATE INDEX IF NOT EXISTS idx_units_block_sector ON units((lower(COALESCE(block_sector, ''))));
CREATE INDEX IF NOT EXISTS idx_units_zone ON units((lower(COALESCE(zone, ''))));