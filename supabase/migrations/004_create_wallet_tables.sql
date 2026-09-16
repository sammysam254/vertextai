-- ============================================
-- 004_create_wallet_tables.sql
-- CallPulse In-App Wallet & Payment Ledger
-- ============================================

-- 1. Add wallet columns to organizations if not present
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS monthly_free_minutes_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_free_minutes_reset TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('topup', 'number_purchase', 'call_usage', 'refund', 'adjustment')),
  amount NUMERIC(10, 4) NOT NULL, -- Positive for credits, negative for debits
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_gateway TEXT NOT NULL DEFAULT 'wallet' CHECK (payment_gateway IN ('paystack', 'nowpayments', 'wallet', 'system', 'manual')),
  payment_reference TEXT,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_tx_org_created ON wallet_transactions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON wallet_transactions(payment_reference);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type);
