-- Create global standard_plan table to store benchmark settings for calculations
CREATE TABLE IF NOT EXISTS standard_plan (
  id SERIAL PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  std_financial_rate_percent NUMERIC(10,4) NOT NULL,
  plan_duration_years INTEGER NOT NULL,
  installment_frequency TEXT NOT NULL, -- 'monthly' | 'quarterly' | 'biannually' | 'annually'
  npv_tolerance_percent NUMERIC(10,4), -- optional threshold for warnings/acceptance
  created_by INTEGER,
  updated_by INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure only one active record at a time (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS ux_standard_plan_single_active
  ON standard_plan (active)
  WHERE active = TRUE;