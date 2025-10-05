-- Add structured fields to standard_pricing and enforce workflow constraints

-- Columns for structured standard data
ALTER TABLE IF EXISTS standard_pricing
  ADD COLUMN IF NOT EXISTS unit_type TEXT,
  ADD COLUMN IF NOT EXISTS area NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS price_per_meter NUMERIC(18,4),
  ADD COLUMN IF NOT EXISTS std_financial_rate_percent NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS plan_duration_years INTEGER,
  ADD COLUMN IF NOT EXISTS installment_frequency TEXT;

-- Frequency constraint
ALTER TABLE IF EXISTS standard_pricing
  DROP CONSTRAINT IF EXISTS standard_pricing_installment_frequency_check;

ALTER TABLE IF EXISTS standard_pricing
  ADD CONSTRAINT standard_pricing_installment_frequency_check CHECK (
    installment_frequency IN ('monthly','quarterly','bi-annually','annually')
    OR installment_frequency IS NULL
  );

-- Auto-calc price_per_meter via trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'standard_pricing_set_price_per_meter') THEN
    CREATE OR REPLACE FUNCTION standard_pricing_set_price_per_meter()
    RETURNS TRIGGER AS $BODY$
    BEGIN
      IF NEW.area IS NOT NULL AND NEW.area > 0 AND NEW.price IS NOT NULL THEN
        NEW.price_per_meter := ROUND(NEW.price / NEW.area::numeric, 4);
      ELSE
        NEW.price_per_meter := NULL;
      END IF;
      RETURN NEW;
    END;
    $BODY$ LANGUAGE plpgsql;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_standard_pricing_set_ppm_ins'
  ) THEN
    CREATE TRIGGER trg_standard_pricing_set_ppm_ins
    BEFORE INSERT ON standard_pricing
    FOR EACH ROW
    EXECUTE FUNCTION standard_pricing_set_price_per_meter();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_standard_pricing_set_ppm_upd'
  ) THEN
    CREATE TRIGGER trg_standard_pricing_set_ppm_upd
    BEFORE UPDATE OF price, area ON standard_pricing
    FOR EACH ROW
    EXECUTE FUNCTION standard_pricing_set_price_per_meter();
  END IF;
END;
$$;

-- Immutability after approval: prevent UPDATE/DELETE when approved
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'prevent_modify_if_approved') THEN
    CREATE OR REPLACE FUNCTION prevent_modify_if_approved()
    RETURNS TRIGGER AS $BODY$
    BEGIN
      IF OLD.status = 'approved' THEN
        RAISE EXCEPTION 'Approved standard_pricing rows are immutable';
      END IF;
      RETURN NULL;
    END;
    $BODY$ LANGUAGE plpgsql;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_update_standard_pricing_when_approved'
  ) THEN
    CREATE TRIGGER trg_prevent_update_standard_pricing_when_approved
    BEFORE UPDATE ON standard_pricing
    FOR EACH ROW
    WHEN (OLD.status = 'approved')
    EXECUTE FUNCTION prevent_modify_if_approved();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_delete_standard_pricing_when_approved'
  ) THEN
    CREATE TRIGGER trg_prevent_delete_standard_pricing_when_approved
    BEFORE DELETE ON standard_pricing
    FOR EACH ROW
    WHEN (OLD.status = 'approved')
    EXECUTE FUNCTION prevent_modify_if_approved();
  END IF;
END;
$$;

-- Ensure only one approved standard per unit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_standard_pricing_one_approved_per_unit'
  ) THEN
    CREATE UNIQUE INDEX uniq_standard_pricing_one_approved_per_unit
      ON standard_pricing(unit_id)
      WHERE status = 'approved';
  END IF;
END;
$$;