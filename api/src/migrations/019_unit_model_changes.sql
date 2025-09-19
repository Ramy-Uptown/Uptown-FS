-- Pending changes for Unit Models requiring Top-Management approval

CREATE TABLE IF NOT EXISTS unit_model_changes (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL, -- create | update | delete
  model_id INTEGER REFERENCES unit_models(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- proposed data or fields to update
  status TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval | approved | rejected
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_model_changes_status ON unit_model_changes(status);
CREATE INDEX IF NOT EXISTS idx_unit_model_changes_model ON unit_model_changes(model_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_unit_model_changes') THEN
    CREATE TRIGGER set_timestamp_unit_model_changes
    BEFORE UPDATE ON unit_model_changes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;