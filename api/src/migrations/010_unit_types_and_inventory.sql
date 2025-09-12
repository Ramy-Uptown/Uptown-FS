-- Unit types and per-type pricing, plus inventory linkage

CREATE TABLE IF NOT EXISTS unit_types (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_unit_types') THEN
    CREATE TRIGGER set_timestamp_unit_types
    BEFORE UPDATE ON unit_types
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;

-- Per-type pricing controlled by financial manager (with approval flow)
CREATE TABLE IF NOT EXISTS unit_type_pricing (
  id SERIAL PRIMARY KEY,
  unit_type_id INTEGER NOT NULL REFERENCES unit_types(id) ON DELETE CASCADE,
  base_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  garden_price NUMERIC(18,2),
  maintenance_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  roof_price NUMERIC(18,2),
  additional_price NUMERIC(18,2),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval | approved | rejected
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_type_pricing_type ON unit_type_pricing(unit_type_id);
CREATE INDEX IF NOT EXISTS idx_unit_type_pricing_status ON unit_type_pricing(status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_unit_type_pricing') THEN
    CREATE TRIGGER set_timestamp_unit_type_pricing
    BEFORE UPDATE ON unit_type_pricing
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;

-- Link units to unit_types (inventory) and availability flag
ALTER TABLE IF EXISTS units
  ADD COLUMN IF NOT EXISTS unit_type_id INTEGER REFERENCES unit_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_units_unit_type_id ON units(unit_type_id);
CREATE INDEX IF NOT EXISTS idx_units_available ON units(available);