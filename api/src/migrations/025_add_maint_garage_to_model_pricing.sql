-- Add maintenance and garage prices to unit_model_pricing
ALTER TABLE IF EXISTS unit_model_pricing
  ADD COLUMN IF NOT EXISTS maintenance_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garage_price NUMERIC(18,2) NOT NULL DEFAULT 0;