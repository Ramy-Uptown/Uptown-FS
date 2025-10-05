-- History for standard_pricing changes and approvals
CREATE TABLE IF NOT EXISTS standard_pricing_history (
  id SERIAL PRIMARY KEY,
  standard_pricing_id INTEGER NOT NULL REFERENCES standard_pricing(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL, -- create | update | approve | reject
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop immutability triggers to allow edits after approval (with workflow review)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_update_standard_pricing_when_approved') THEN
    DROP TRIGGER trg_prevent_update_standard_pricing_when_approved ON standard_pricing;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_delete_standard_pricing_when_approved') THEN
    DROP TRIGGER trg_prevent_delete_standard_pricing_when_approved ON standard_pricing;
  END IF;

  -- Function may be used elsewhere; drop only if desired
  -- IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'prevent_modify_if_approved') THEN
  --   DROP FUNCTION prevent_modify_if_approved();
  -- END IF;
END;
$$;