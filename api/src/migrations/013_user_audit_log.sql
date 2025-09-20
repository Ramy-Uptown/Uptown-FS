-- Create the generic updated_at trigger function (used by multiple tables)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Audit log for admin-initiated changes to users
CREATE TABLE IF NOT EXISTS user_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- e.g. set_role, set_active, update_profile, set_password, create_user, deactivate_user
  changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_audit_log_user ON user_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_changed_by ON user_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_action ON user_audit_log(action);