-- Dual Top-Management approvals for over-policy-limit discounts

CREATE TABLE IF NOT EXISTS payment_plan_tm_approvals (
  id SERIAL PRIMARY KEY,
  payment_plan_id INTEGER NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  approver_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL DEFAULT 'approve', -- currently only 'approve'; can extend to 'reject' if needed per-user
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_plan_id, approver_user_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_plan_tm_approvals_plan ON payment_plan_tm_approvals(payment_plan_id);