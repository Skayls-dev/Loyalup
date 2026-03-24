-- Add transaction_type column to distinguish purchases from reward redemptions at the caisse.
-- 'purchase'          — standard point-credit transaction (default, backward-compatible)
-- 'reward_redemption' — reward consumed at the caisse; montant=0, points_credited is negative (points spent)

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'purchase'
  CONSTRAINT transactions_type_check CHECK (transaction_type IN ('purchase', 'reward_redemption'));

-- Index to efficiently filter by type in history queries
CREATE INDEX IF NOT EXISTS idx_transactions_type
  ON public.transactions (transaction_type);
