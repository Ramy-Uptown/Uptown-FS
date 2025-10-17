-- Add financial fields to unit_model_pricing so FM can configure and TM can approve them
ALTER TABLE IF EXISTS unit_model_pricing
  ADD COLUMN IF NOT EXISTS std_financial_rate_percent NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS plan_duration_years INTEGER,
  ADD COLUMN IF NOT EXISTS installment_frequency TEXT, -- 'monthly' | 'quarterly' | 'biannually' | 'annually'
  ADD COLUMN IF NOT EXISTS calculated_pv NUMERIC(18,2);

-- Optional: ensure frequency is one of allowed values (soft check via trigger or application validation)