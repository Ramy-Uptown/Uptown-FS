-- Indexes to improve common queries and joins

-- deals
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_created_by ON deals(created_by);
CREATE INDEX IF NOT EXISTS idx_deals_sales_rep_id ON deals(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_deals_policy_id ON deals(policy_id);

-- deal_history
CREATE INDEX IF NOT EXISTS idx_deal_history_deal_id ON deal_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_history_user_id ON deal_history(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_history_action ON deal_history(action);

-- deal_commissions
CREATE INDEX IF NOT EXISTS idx_deal_commissions_deal_id ON deal_commissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_commissions_sales_person_id ON deal_commissions(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_deal_commissions_policy_id ON deal_commissions(policy_id);

-- sales_people
CREATE INDEX IF NOT EXISTS idx_sales_people_user_id ON sales_people(user_id);

-- commission_policies
CREATE INDEX IF NOT EXISTS idx_commission_policies_active ON commission_policies(active);