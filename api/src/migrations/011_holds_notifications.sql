-- Holds and notifications

CREATE TABLE IF NOT EXISTS holds (
  id SERIAL PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  payment_plan_id INTEGER REFERENCES payment_plans(id) ON DELETE SET NULL,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval | approved | unblocked | expired | reserved
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  next_notify_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holds_unit ON holds(unit_id);
CREATE INDEX IF NOT EXISTS idx_holds_status ON holds(status);
CREATE INDEX IF NOT EXISTS idx_holds_next_notify ON holds(next_notify_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_holds') THEN
    CREATE TRIGGER set_timestamp_holds
    BEFORE UPDATE ON holds
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;

-- Simple notifications queue
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- hold_reminder | generic
  ref_table TEXT,
  ref_id INTEGER,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);