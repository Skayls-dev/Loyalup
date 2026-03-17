-- Seed: publicité alimentaire exemple
INSERT INTO scan_screen_ads (
  title,
  body,
  cta_label,
  cta_url,
  media_type,
  media_url,
  active,
  display_order
)
VALUES (
  'Epicerie fraiche - Produits locaux livrés chaque matin',
  'Fruits, légumes, fromages et charcuterie sélectionnés chaque matin chez nos producteurs partenaires. -15% avec 250 pts LoyalUp.',
  'Commander maintenant',
  'https://loyalup-pink.vercel.app/client',
  'image',
  '/ads/epicerie-fraiche.svg',
  true,
  5
)
ON CONFLICT DO NOTHING;
