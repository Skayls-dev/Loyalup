-- Add advertiser_name to scan_screen_ads
ALTER TABLE scan_screen_ads ADD COLUMN IF NOT EXISTS advertiser_name TEXT;

-- Backfill existing ads
UPDATE scan_screen_ads SET advertiser_name = 'Epicerie Fraiche'
  WHERE title ILIKE '%picerie%' AND advertiser_name IS NULL;

UPDATE scan_screen_ads SET advertiser_name = 'LoyalUp'
  WHERE advertiser_name IS NULL;
