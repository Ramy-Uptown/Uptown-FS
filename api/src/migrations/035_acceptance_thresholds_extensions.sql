-- Extend payment thresholds and proposals with Year 3 and PV tolerance
DO $$
BEGIN
  -- payment_thresholds
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_thresholds' AND column_name = 'third_year_percent_min'
  ) THEN
    ALTER TABLE payment_thresholds
      ADD COLUMN third_year_percent_min NUMERIC NULL,
      ADD COLUMN third_year_percent_max NUMERIC NULL,
      ADD COLUMN pv_tolerance_percent NUMERIC NULL;
  END IF;

  -- payment_threshold_proposals
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_threshold_proposals' AND column_name = 'third_year_percent_min'
  ) THEN
    ALTER TABLE payment_threshold_proposals
      ADD COLUMN third_year_percent_min NUMERIC NULL,
      ADD COLUMN third_year_percent_max NUMERIC NULL,
      ADD COLUMN pv_tolerance_percent NUMERIC NULL;
  END IF;

  -- standard_pricing: add manager's target payment after 1 year
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'standard_pricing' AND column_name = 'target_payment_after_1y'
  ) THEN
    ALTER TABLE standard_pricing
      ADD COLUMN target_payment_after_1y NUMERIC NULL;
  END IF;
END$$;