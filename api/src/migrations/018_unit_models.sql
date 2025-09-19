-- Unit Models and Audit Trail

-- Main table
CREATE TABLE IF NOT EXISTS unit_models (
  id SERIAL PRIMARY KEY,
  model_name TEXT NOT NULL,
  area NUMERIC(12,2) NOT NULL DEFAULT 0,
  orientation TEXT NOT NULL DEFAULT 'left', -- left | right | whole_floor
  has_garden BOOLEAN NOT NULL DEFAULT FALSE,
  garden_area NUMERIC(12,2),
  has_roof BOOLEAN NOT NULL DEFAULT FALSE,
  roof_area NUMERIC(12,2),
  garage_area NUMERIC(12,2),
  garage_standard_code TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_models_name ON unit_models(model_name);
CREATE INDEX IF NOT EXISTS idx_unit_models_orientation ON unit_models(orientation);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_unit_models') THEN
    CREATE TRIGGER set_timestamp_unit_models
    BEFORE UPDATE ON unit_models
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;

-- Audit log table
CREATE TABLE IF NOT EXISTS unit_model_audit (
  id SERIAL PRIMARY KEY,
  model_id INTEGER NOT NULL REFERENCES unit_models(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- create | update | delete
  changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_model_audit_model ON unit_model_audit(model_id);
CREATE INDEX IF NOT EXISTS idx_unit_model_audit_action ON unit_model_audit(action);
CREATE INDEX IF NOT EXISTS idx_unit_model_audit_changed_by ON unit_model_audit(changed_by);