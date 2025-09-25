-- Enforce unique unit code to prevent duplication
ALTER TABLE IF EXISTS units
  ADD CONSTRAINT IF NOT EXISTS units_code_unique UNIQUE (code);