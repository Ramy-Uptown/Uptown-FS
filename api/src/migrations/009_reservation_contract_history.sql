-- History logs for reservation forms and contracts

CREATE TABLE IF NOT EXISTS reservation_forms_history (
  id SERIAL PRIMARY KEY,
  reservation_form_id INTEGER NOT NULL REFERENCES reservation_forms(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL, -- create | update | approve | reject
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts_history (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL, -- create | update | approve | reject
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);