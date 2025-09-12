-- Sales team assignments: map manager to consultants (many-to-many)
CREATE TABLE IF NOT EXISTS sales_team_members (
  id SERIAL PRIMARY KEY,
  manager_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consultant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manager_user_id, consultant_user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_sales_team_members'
  ) THEN
    CREATE TRIGGER set_timestamp_sales_team_members
    BEFORE UPDATE ON sales_team_members
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sales_team_members_manager ON sales_team_members(manager_user_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sales_team_members_consultant ON sales_team_members(consultant_user_id) WHERE active = TRUE;