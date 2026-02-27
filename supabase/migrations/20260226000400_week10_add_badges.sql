INSERT INTO badge_definitions (
  code,
  name,
  description,
  emoji,
  category,
  rarity,
  trigger_type,
  trigger_value,
  is_active,
  is_secret,
  points_reward
) VALUES
(
  'loyal_250',
  '{"fr":"Titan de fidélité","en":"Loyal Titan","ar":"عملاق الولاء","es":"Titán de lealtad","nl":"Loyaliteits-titaan"}',
  '{"fr":"Effectuez 250 transactions","en":"Make 250 transactions","ar":"أجرِ 250 معاملة","es":"Realiza 250 transacciones","nl":"Voer 250 transacties uit"}',
  '🛡️',
  'milestone',
  'epic',
  'transaction_count',
  250,
  true,
  false,
  0
),
(
  'market_mogul',
  '{"fr":"Magnat du marché","en":"Market Mogul","ar":"قطب السوق","es":"Magnate del mercado","nl":"Marktmagnaat"}',
  '{"fr":"Transférez des points 50 fois","en":"Transfer points 50 times","ar":"انقل النقاط 50 مرة","es":"Transfiere puntos 50 veces","nl":"Draag 50 keer punten over"}',
  '🏦',
  'marketplace',
  'epic',
  'transfer_count',
  50,
  true,
  false,
  0
),
(
  'referral_oracle',
  '{"fr":"Oracle du parrainage","en":"Referral Oracle","ar":"عرّاف الإحالة","es":"Oráculo del referido","nl":"Referral-orakel"}',
  '{"fr":"Parrainez 25 amis","en":"Refer 25 friends","ar":"رشح 25 صديقًا","es":"Refiere a 25 amigos","nl":"Nodig 25 vrienden uit"}',
  '🧠',
  'social',
  'legendary',
  'referral_count',
  25,
  true,
  false,
  0
),
(
  'streak_365',
  '{"fr":"Année parfaite","en":"Perfect Year","ar":"عام مثالي","es":"Año perfecto","nl":"Perfect jaar"}',
  '{"fr":"Scanner 365 jours consécutifs","en":"Scan 365 days in a row","ar":"امسح 365 يومًا متتاليًا","es":"Escanea 365 días seguidos","nl":"Scan 365 dagen achter elkaar"}',
  '🗓️',
  'streak',
  'legendary',
  'streak_days',
  365,
  true,
  false,
  0
)
ON CONFLICT (code) DO NOTHING;
