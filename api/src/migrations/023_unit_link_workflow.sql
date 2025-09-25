-- Inventory-Model link workflow (Financial Admin -> Financial Manager approval)

CREATE TABLE IF NOT EXISTS unit_model_inventory_links (
  id SERIAL PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  model_id INTEGER NOT NULL REFERENCES unit_models(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval | approved | rejected
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id) -- one active link per unit (latest state tracked by status)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_unit_model_inventory_links') THEN
    CREATE TRIGGER set_timestamp_unit_model_inventory_links
    BEFORE UPDATE ON unit_model_inventory_links
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS unit_model_inventory_link_audit (
  id SERIAL PRIMARY KEY,
  link_id INTEGER NOT NULL REFERENCES unit_model_inventory_links(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- request | approve | reject
  changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_model_inventory_links_status ON unit_model_inventory_links(status);
CREATE INDEX IF NOT EXISTS idx_unit_model_inventory_links_unit ON unit_model_inventory_links(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_model_inventory_links_model ON unit_model_inventory_links(model_id);
CREATE INDEX IF NOT EXISTS idx_unit_model_inventory_link_audit_link ON unit_model_inventory_link_audit(link_id);