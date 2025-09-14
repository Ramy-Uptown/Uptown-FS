-- Deprecate legacy pending_ceo_approval by moving to new queues
-- Payment plans awaiting CEO become pending_tm (Top-Management)
UPDATE payment_plans
SET status='pending_tm', updated_at=now()
WHERE status='pending_ceo_approval';

-- Reservation and contracts flows still use CEO for finalization; no change here.