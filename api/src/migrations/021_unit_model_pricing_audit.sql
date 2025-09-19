-- Audit log for unit_model_pricing changes

CREATE TABLE IF NOT EXISTS unit_model_pricing_audit (
  id SERIAL PRIMARY KEY,
  pricing_id INTEGER NOT NULL REFERENCES unit_model_pricing(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- upsert | approve | reject
  changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_um_pricing_audit_pricing ON unit_model_pricing_audit(pricing_id);
CREATE INDEX IF NOT EXISTS idx_um_pricing_audit_action ON unit_model_pricing_audit(action);
CREATE INDEX IF NOT EXISTS idx_um_pricing_audit_changed_by ON unit_model_pricing_audit(changed_by);