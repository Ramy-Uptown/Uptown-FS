-- Add staged override review columns to deals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'manager_review_by'
  ) THEN
    ALTER TABLE deals
      ADD COLUMN manager_review_by INT NULL,
      ADD COLUMN manager_review_at TIMESTAMP NULL,
      ADD COLUMN fm_review_by INT NULL,
      ADD COLUMN fm_review_at TIMESTAMP NULL;
  END IF;
END$$;