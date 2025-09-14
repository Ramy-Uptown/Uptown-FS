-- Extend units with status and meta fields to support draft/approval workflow

ALTER TABLE IF EXISTS units
  ADD COLUMN IF NOT EXISTS unit_status TEXT NOT NULL DEFAULT 'AVAILABLE', -- INVENTORY_DRAFT | AVAILABLE | INVENTORY_REJECTED | SOLD | RESERVED | BLOCKED
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Optional: constrain known statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name='units' AND column_name='unit_status'
  ) THEN
    ALTER TABLE units
      ADD CONSTRAINT units_status_check CHECK (unit_status IN (
        'INVENTORY_DRAFT','AVAILABLE','INVENTORY_REJECTED','RESERVED','SOLD','BLOCKED'
      ));
  END IF;
END;
$$;

-- Backfill existing rows to AVAILABLE explicitly (noop if already defaulted)
UPDATE units SET unit_status='AVAILABLE' WHERE unit_status IS NULL;