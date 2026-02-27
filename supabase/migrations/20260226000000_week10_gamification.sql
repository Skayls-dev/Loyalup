-- Week 10: Marketplace, Referral, Gamification
-- Coalition network, point transfers, badges, levels, challenges, leaderboards

-- ============================================================================
-- Coalition Network: providers supporting points transfer
-- ============================================================================
CREATE TABLE provider_coalitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  created_by UUID REFERENCES fournisseurs(id) ON DELETE SET NULL,
  conversion_rate NUMERIC NOT NULL DEFAULT 1.0,
  -- 1.0 = 1 point at Provider A = 1 point at Provider B
  platform_fee_pct NUMERIC NOT NULL DEFAULT 0.10,
  -- 10% fee on transfers
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_coalitions_active ON provider_coalitions(is_active);

CREATE TABLE coalition_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coalition_id UUID NOT NULL REFERENCES provider_coalitions(id) ON DELETE CASCADE,
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'active' | 'suspended' | 'left'
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  invited_by UUID REFERENCES fournisseurs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coalition_id, fournisseur_id)
);

CREATE INDEX idx_coalition_members_fournisseur ON coalition_members(fournisseur_id, status);
CREATE INDEX idx_coalition_members_coalition ON coalition_members(coalition_id, status);

-- ============================================================================
-- Point Transfers: cross-provider
-- ============================================================================
CREATE TABLE point_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id),
  to_fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id),
  coalition_id UUID NOT NULL REFERENCES provider_coalitions(id),
  points_deducted INTEGER NOT NULL,
  points_credited INTEGER NOT NULL,
  platform_fee_points INTEGER NOT NULL,
  conversion_rate NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_point_transfers_client ON point_transfers(client_id, created_at DESC);
CREATE INDEX idx_point_transfers_providers ON point_transfers(from_fournisseur_id, to_fournisseur_id);

-- ============================================================================
-- Referral Programs
-- ============================================================================
CREATE TABLE client_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- NULL until registration
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'activated' | 'rewarded' | 'expired'
  points_awarded_referrer INTEGER NOT NULL DEFAULT 0,
  points_awarded_referred INTEGER NOT NULL DEFAULT 0,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  -- which provider's points are used for reward
  activated_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_client_referrals_referrer ON client_referrals(referrer_id, status);
CREATE INDEX idx_client_referrals_code ON client_referrals(referral_code);
CREATE INDEX idx_client_referrals_referred ON client_referrals(referred_id, status);

CREATE TABLE provider_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'activated' | 'rewarded'
  commission_pct NUMERIC NOT NULL DEFAULT 0.10,
  commission_earned NUMERIC NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id)
);

CREATE INDEX idx_provider_referrals_referrer ON provider_referrals(referrer_id, status);

-- ============================================================================
-- Badge Definitions & Earned Badges
-- ============================================================================
CREATE TABLE badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name JSONB NOT NULL,
  -- { fr: string, en: string, ar: string, es: string, nl: string }
  description JSONB NOT NULL,
  emoji TEXT NOT NULL,
  category TEXT NOT NULL,
  -- 'milestone' | 'points' | 'social' | 'explorer' | 'streak' | 'marketplace' | 'secret'
  rarity TEXT NOT NULL DEFAULT 'common',
  -- 'common' | 'rare' | 'epic' | 'legendary'
  trigger_type TEXT NOT NULL,
  -- 'transaction_count' | 'points_total' | 'provider_count'
  -- | 'streak_days' | 'referral_count' | 'spend_amount' | 'transfer_count'
  trigger_value NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  points_reward INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_badge_definitions_trigger ON badge_definitions(trigger_type, is_active);
CREATE INDEX idx_badge_definitions_secret ON badge_definitions(is_secret) WHERE is_active;

CREATE TABLE client_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badge_definitions(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shared_at TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(client_id, badge_id)
);

CREATE INDEX idx_client_badges_client ON client_badges(client_id, unlocked_at DESC);

-- ============================================================================
-- Levels & XP
-- ============================================================================
CREATE TABLE level_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number INTEGER UNIQUE NOT NULL,
  name JSONB NOT NULL,
  emoji TEXT NOT NULL,
  min_xp INTEGER NOT NULL,
  max_xp INTEGER NOT NULL,
  color VARCHAR(7) NOT NULL,
  -- hex color
  perks JSONB NOT NULL DEFAULT '[]',
  -- [{ description: { fr, en... }, type, value }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_level_definitions_xp ON level_definitions(min_xp, max_xp);

CREATE TABLE client_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  xp_total INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1 REFERENCES level_definitions(level_number),
  last_xp_earned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_client_levels_xp ON client_levels(xp_total DESC);

CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  -- 'scan' | 'badge' | 'referral' | 'streak' | 'transfer' | 'challenge' | 'bonus'
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xp_transactions_client ON xp_transactions(client_id, created_at DESC);

-- ============================================================================
-- Challenges & Progress
-- ============================================================================
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fournisseur_id UUID REFERENCES fournisseurs(id) ON DELETE CASCADE,
  -- NULL = platform-wide challenge
  title JSONB NOT NULL,
  description JSONB NOT NULL,
  emoji TEXT NOT NULL,
  type TEXT NOT NULL,
  -- 'visit_count' | 'spend_amount' | 'streak' | 'referral' | 'provider_count' | 'transfer'
  target_value NUMERIC NOT NULL,
  reward_points INTEGER NOT NULL,
  reward_xp INTEGER NOT NULL,
  reward_badge_id UUID REFERENCES badge_definitions(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_challenges_active ON challenges(is_active, ends_at DESC);
CREATE INDEX idx_challenges_provider ON challenges(fournisseur_id, is_active);

CREATE TABLE client_challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  current_value NUMERIC NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, challenge_id)
);

CREATE INDEX idx_challenge_progress_client ON client_challenge_progress(client_id, completed DESC);
CREATE INDEX idx_challenge_progress_challenge ON client_challenge_progress(challenge_id, completed DESC);

-- ============================================================================
-- Streaks
-- ============================================================================
CREATE TABLE client_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fournisseur_id UUID REFERENCES fournisseurs(id) ON DELETE CASCADE,
  -- NULL = any provider streak
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_visit_date DATE,
  streak_broken_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, fournisseur_id)
);

CREATE INDEX idx_client_streaks_client ON client_streaks(client_id);
CREATE INDEX idx_client_streaks_longest ON client_streaks(longest_streak DESC);

-- ============================================================================
-- Leaderboards (recomputed daily)
-- ============================================================================
CREATE TABLE leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_type TEXT NOT NULL,
  -- 'global_points' | 'global_xp' | 'provider_points' | 'referrals' | 'streak'
  fournisseur_id UUID REFERENCES fournisseurs(id),
  -- NULL for global leaderboards
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score NUMERIC NOT NULL,
  period TEXT NOT NULL,
  -- 'all_time' | 'YYYY-MM' | 'YYYY-Www'
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(leaderboard_type, fournisseur_id, client_id, period)
);

CREATE INDEX idx_leaderboard_entries_type ON leaderboard_entries(leaderboard_type, period, rank);
CREATE INDEX idx_leaderboard_entries_client ON leaderboard_entries(client_id, period);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- provider_coalitions: public SELECT (clients can browse)
ALTER TABLE provider_coalitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select coalitions"
  ON provider_coalitions FOR SELECT TO authenticated
  USING (is_active = true);

-- Allow providers to update their own coalitions
CREATE POLICY "Providers manage coalitions"
  ON provider_coalitions FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- coalition_members: providers SELECT/INSERT their own
ALTER TABLE coalition_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers view coalition members"
  ON coalition_members FOR SELECT TO authenticated
  USING (
    fournisseur_id = auth.uid() OR
    coalition_id IN (
      SELECT coalition_id FROM coalition_members WHERE fournisseur_id = auth.uid()
    )
  );

CREATE POLICY "Providers join existing coalitions"
  ON coalition_members FOR INSERT TO authenticated
  WITH CHECK (fournisseur_id = auth.uid());

-- point_transfers: clients SELECT their own only
ALTER TABLE point_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own transfers"
  ON point_transfers FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "System insert transfers"
  ON point_transfers FOR INSERT TO authenticated
  WITH CHECK (true);

-- client_referrals: clients SELECT where they own either side
ALTER TABLE client_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own referrals"
  ON client_referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "Clients create referrals"
  ON client_referrals FOR INSERT TO authenticated
  WITH CHECK (referrer_id = auth.uid());

-- badge_definitions: public SELECT (non-secret only for guests)
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view active badges"
  ON badge_definitions FOR SELECT
  USING (is_active = true AND is_secret = false);

CREATE POLICY "Authenticated view all badges"
  ON badge_definitions FOR SELECT TO authenticated
  USING (is_active = true);

-- client_badges: clients SELECT their own
ALTER TABLE client_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own badges"
  ON client_badges FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "System insert badges"
  ON client_badges FOR INSERT TO authenticated
  WITH CHECK (true);

-- client_levels: clients SELECT their own
ALTER TABLE client_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own level"
  ON client_levels FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "System upsert levels"
  ON client_levels FOR INSERT TO authenticated
  WITH CHECK (true);

-- xp_transactions: clients SELECT their own
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own xp"
  ON xp_transactions FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "System insert xp"
  ON xp_transactions FOR INSERT TO authenticated
  WITH CHECK (true);

-- challenges: public SELECT active
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view active challenges"
  ON challenges FOR SELECT
  USING (is_active = true AND starts_at <= NOW() AND ends_at >= NOW());

-- client_challenge_progress: clients SELECT their own
ALTER TABLE client_challenge_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own progress"
  ON client_challenge_progress FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "System upsert progress"
  ON client_challenge_progress FOR INSERT TO authenticated
  WITH CHECK (true);

-- client_streaks: clients SELECT their own
ALTER TABLE client_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own streaks"
  ON client_streaks FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "System upsert streaks"
  ON client_streaks FOR INSERT TO authenticated
  WITH CHECK (true);

-- leaderboard_entries: public SELECT (anonymous display names later)
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view leaderboards"
  ON leaderboard_entries FOR SELECT
  USING (true);

CREATE POLICY "System insert leaderboard"
  ON leaderboard_entries FOR INSERT TO authenticated
  WITH CHECK (true);
