-- Add model_code to unit_models and create pricing table for unit models

ALTER TABLE IF EXISTS unit_models
  ADD COLUMN IF NOT EXISTS model_code TEXT UNIQUE;

-- Pricing per unit model (one active row per model; we will enforce 1 row via unique index)
CREATE TABLE IF NOT EXISTS unit_model_pricing (
  id SERIAL PRIMARY KEY,
  model_id INTEGER NOT NULL REFERENCES unit_models(id) ON DELETE CASCADE,
  price NUMERIC(18,2) NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval | approved | rejected
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_model_pricing_model ON unit_model_pricing(model_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_unit_model_pricing') THEN
    CREATE TRIGGER set_timestamp_unit_model_pricing
    BEFORE UPDATE ON unit_model_pricing
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;