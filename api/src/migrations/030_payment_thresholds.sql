-- Payment thresholds configuration (central, single-row table)

CREATE TABLE IF NOT EXISTS payment_thresholds (
  id SERIAL PRIMARY KEY,
  first_year_percent_min NUMERIC(7,3),
  first_year_percent_max NUMERIC(7,3),
  second_year_percent_min NUMERIC(7,3),
  second_year_percent_max NUMERIC(7,3),
  handover_percent_min NUMERIC(7,3),
  handover_percent_max NUMERIC(7,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to maintain updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_payment_thresholds'
  ) THEN
    CREATE TRIGGER set_timestamp_payment_thresholds
    BEFORE UPDATE ON payment_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;

-- Seed a default row if table is empty
INSERT INTO payment_thresholds (
  first_year_percent_min,
  first_year_percent_max,
  second_year_percent_min,
  second_year_percent_max,
  handover_percent_min,
  handover_percent_max
)
SELECT 10, NULL, 15, NULL, NULL, 5
WHERE NOT EXISTS (SELECT 1 FROM payment_thresholds);