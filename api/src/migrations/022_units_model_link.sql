-- Link inventory units to unit models (designed by Financial Manager)
-- Safe to run multiple times.

ALTER TABLE IF EXISTS units
  ADD COLUMN IF NOT EXISTS model_id INTEGER REFERENCES unit_models(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_units_model_id ON units(model_id);