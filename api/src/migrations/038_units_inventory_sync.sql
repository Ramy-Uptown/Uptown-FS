-- Safety migration to ensure all expected inventory fields exist on units.
-- This is idempotent and only adds missing columns/indexes.
-- It does NOT alter existing columns or drop anything.

BEGIN;

ALTER TABLE IF EXISTS units
  ADD COLUMN IF NOT EXISTS unit_number TEXT,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS building_number TEXT,
  ADD COLUMN IF NOT EXISTS block_sector TEXT,
  ADD COLUMN IF NOT EXISTS zone TEXT,
  ADD COLUMN IF NOT EXISTS garden_details TEXT,
  ADD COLUMN IF NOT EXISTS area NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS orientation TEXT,
  ADD COLUMN IF NOT EXISTS has_garden BOOLEAN,
  ADD COLUMN IF NOT EXISTS garden_area NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS has_roof BOOLEAN,
  ADD COLUMN IF NOT EXISTS roof_area NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS maintenance_price NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garage_price NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garden_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roof_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_status TEXT NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Helpful indexes (create only if missing)
CREATE INDEX IF NOT EXISTS idx_units_unit_number ON units((lower(COALESCE(unit_number, ''))));
CREATE INDEX IF NOT EXISTS idx_units_block_sector ON units((lower(COALESCE(block_sector, ''))));
CREATE INDEX IF NOT EXISTS idx_units_zone ON units((lower(COALESCE(zone, ''))));
CREATE INDEX IF NOT EXISTS idx_units_area ON units(area);

-- Optional: enforce allowed unit_status values (only if constraint not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'units_status_check'
      AND conrelid = 'units'::regclass
  ) THEN
    ALTER TABLE units
      ADD CONSTRAINT units_status_check CHECK (unit_status IN (
        'INVENTORY_DRAFT','AVAILABLE','INVENTORY_REJECTED','RESERVED','SOLD','BLOCKED'
      ));
  END IF;
END;
$$;

COMMIT;