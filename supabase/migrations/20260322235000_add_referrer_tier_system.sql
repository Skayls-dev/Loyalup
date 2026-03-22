-- Add referrer tier system to support 5-tier progression structure
-- Tier 1: Novice (0 referrals)
-- Tier 2: Starter (5 referrals)
-- Tier 3: Promoter (15 referrals)
-- Tier 4: Ambassador (30 referrals)
-- Tier 5: Elite (50+ referrals)

-- Add tier columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referrer_tier INT DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create tier reference table for documentation
CREATE TABLE IF NOT EXISTS referrer_tiers (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  min_referrals INT NOT NULL,
  max_referrals INT,
  description TEXT,
  perks TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert tier definitions
DELETE FROM referrer_tiers; -- Clear if exists from previous run
INSERT INTO referrer_tiers (id, name, min_referrals, max_referrals, description, perks) VALUES
  (1, 'Novice', 0, 4, 'Just started your referral journey', ARRAY[]::TEXT[]),
  (2, 'Starter', 5, 14, 'Growing your network', ARRAY['Dashboard analytics']),
  (3, 'Promoter', 15, 29, 'Your influence is spreading', ARRAY['Dashboard analytics', 'Early access to features']),
  (4, 'Ambassador', 30, 49, 'Recognized brand representative', ARRAY['Dashboard analytics', 'Early access to features', 'Public badge on profile']),
  (5, 'Elite', 50, NULL, 'Top referrer on the platform', ARRAY['Dashboard analytics', 'Early access to features', 'Public badge on profile', 'Priority support']);

-- Function to calculate referrer tier based on activated referrals count
CREATE OR REPLACE FUNCTION calculate_referrer_tier(referrer_id UUID)
RETURNS INT AS $$
DECLARE
  v_activated_count INT;
  v_tier INT := 1;
BEGIN
  -- Count all activated referrals for this user (only status='activated' or 'rewarded' = actually used)
  SELECT COUNT(*) INTO v_activated_count
  FROM client_referrals
  WHERE referrer_id = $1
    AND status IN ('activated', 'rewarded');
  
  -- Determine tier based on count
  IF v_activated_count >= 50 THEN
    v_tier := 5;
  ELSIF v_activated_count >= 30 THEN
    v_tier := 4;
  ELSIF v_activated_count >= 15 THEN
    v_tier := 3;
  ELSIF v_activated_count >= 5 THEN
    v_tier := 2;
  ELSE
    v_tier := 1;
  END IF;
  
  RETURN v_tier;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update referrer tier (called after referral activation)
CREATE OR REPLACE FUNCTION update_referrer_tier_on_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update tier if status changed to 'activated' or 'rewarded'
  IF (NEW.status IN ('activated', 'rewarded')) AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    UPDATE profiles
    SET 
      referrer_tier = calculate_referrer_tier(NEW.referrer_id),
      tier_updated_at = NOW()
    WHERE id = NEW.referrer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update tier when referral is activated
DROP TRIGGER IF EXISTS trigger_update_referrer_tier ON client_referrals;
CREATE TRIGGER trigger_update_referrer_tier
  AFTER INSERT OR UPDATE ON client_referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_referrer_tier_on_activation();

-- Grant permissions for anon user (public queries)
GRANT SELECT ON referrer_tiers TO anon;
GRANT SELECT ON referrer_tiers TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE referrer_tiers IS 'Tier definitions for the 5-level referrer progression system';
COMMENT ON COLUMN profiles.referrer_tier IS 'Current tier level (1-5) based on activated referrals count';
COMMENT ON COLUMN profiles.tier_updated_at IS 'Timestamp when tier was last calculated/updated';
