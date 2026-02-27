-- Week 10 Seed: Level Definitions
-- 10 levels with perks progression

INSERT INTO level_definitions (level_number, name, emoji, min_xp, max_xp, color, perks) VALUES

(1, 
  '{"fr": "Découvreur", "en": "Discoverer", "ar": "المكتشف", "es": "Descubridor", "nl": "Ontdekker"}',
  '🌱',
  0,
  99,
  '#6B7194',
  '[]'
),

(2,
  '{"fr": "Habitué", "en": "Regular", "ar": "المداوم", "es": "Habitual", "nl": "Gewoontegebruiker"}',
  '☕',
  100,
  299,
  '#00C9B1',
  '[{"description": {"fr": "+5% bonus points sur chaque scan", "en": "+5% bonus points on every scan", "ar": "+5% نقاط مكافأة على كل فحص", "es": "+5% puntos bonus en cada escaneo", "nl": "+5% bonuspunten op elke scan"}, "type": "bonus_points_pct", "value": 5}]'
),

(3,
  '{"fr": "Fidèle", "en": "Loyal", "ar": "المخلص", "es": "Leal", "nl": "Trouw"}',
  '⭐',
  300,
  699,
  '#FFB347',
  '[{"description": {"fr": "+10% bonus points", "en": "+10% bonus points", "ar": "+10% نقاط مكافأة", "es": "+10% puntos bonus", "nl": "+10% bonuspunten"}, "type": "bonus_points_pct", "value": 10}, {"description": {"fr": "Accès anticipé aux promos", "en": "Early promo access", "ar": "الوصول المبكر للعروض", "es": "Acceso anticipado a promos", "nl": "Vroege toegang tot promos"}, "type": "early_promo", "value": 1}]'
),

(4,
  '{"fr": "Champion", "en": "Champion", "ar": "البطل", "es": "Campeón", "nl": "Kampioen"}',
  '🏅',
  700,
  1499,
  '#FF6B35',
  '[{"description": {"fr": "+15% bonus points", "en": "+15% bonus points", "ar": "+15% نقاط مكافأة", "es": "+15% puntos bonus", "nl": "+15% bonuspunten"}, "type": "bonus_points_pct", "value": 15}, {"description": {"fr": "File de validation prioritaire", "en": "Priority validation queue", "ar": "قائمة انتظار التحقق الأولوية", "es": "Cola de validación prioritaria", "nl": "Prioriteitswachtrij validatie"}, "type": "priority_queue", "value": 1}]'
),

(5,
  '{"fr": "Expert", "en": "Expert", "ar": "الخبير", "es": "Experto", "nl": "Deskundige"}',
  '💎',
  1500,
  2999,
  '#9B6DFF',
  '[{"description": {"fr": "+20% bonus points", "en": "+20% bonus points", "ar": "+20% نقاط مكافأة", "es": "+20% puntos bonus", "nl": "+20% bonuspunten"}, "type": "bonus_points_pct", "value": 20}, {"description": {"fr": "Badges exclusifs débloqués", "en": "Exclusive badges unlocked", "ar": "الشارات الحصرية مفتوحة", "es": "Insignias exclusivas desbloqueadas", "nl": "Exclusieve insignes ontgrendeld"}, "type": "exclusive_badge", "value": 1}]'
),

(6,
  '{"fr": "Maître", "en": "Master", "ar": "الماجستير", "es": "Maestro", "nl": "Meester"}',
  '🔥',
  3000,
  5999,
  '#FF4757',
  '[{"description": {"fr": "+25% bonus points", "en": "+25% bonus points", "ar": "+25% نقاط مكافأة", "es": "+25% puntos bonus", "nl": "+25% bonuspunten"}, "type": "bonus_points_pct", "value": 25}, {"description": {"fr": "Frais de transfert gratuits", "en": "Free transfer fees", "ar": "رسوم النقل مجانية", "es": "Tarifas de transferencia gratuitas", "nl": "Gratis overboekingskosten"}, "type": "free_transfer_fees", "value": 1}]'
),

(7,
  '{"fr": "Légende", "en": "Legend", "ar": "أسطورة", "es": "Leyenda", "nl": "Legende"}',
  '👑',
  6000,
  11999,
  '#FFD700',
  '[{"description": {"fr": "+30% bonus points", "en": "+30% bonus points", "ar": "+30% نقاط مكافأة", "es": "+30% puntos bonus", "nl": "+30% bonuspunten"}, "type": "bonus_points_pct", "value": 30}, {"description": {"fr": "Gestionnaire de fidélité personnel", "en": "Personal loyalty manager", "ar": "مدير الولاء الشخصي", "es": "Gestor de fidelización personal", "nl": "Persoonlijke loyaliteitsmanager"}, "type": "personal_manager", "value": 1}]'
),

(8,
  '{"fr": "Mythique", "en": "Mythic", "ar": "الأسطوري", "es": "Mítico", "nl": "Mythisch"}',
  '⚡',
  12000,
  24999,
  '#00D2FF',
  '[{"description": {"fr": "+40% bonus points", "en": "+40% bonus points", "ar": "+40% نقاط مكافأة", "es": "+40% puntos bonus", "nl": "+40% bonuspunten"}, "type": "bonus_points_pct", "value": 40}, {"description": {"fr": "Accès VIP anticipé", "en": "VIP early access", "ar": "الوصول المبكر لـ VIP", "es": "Acceso anticipado VIP", "nl": "VIP vroege toegang"}, "type": "vip_early_access", "value": 1}]'
),

(9,
  '{"fr": "Immortel", "en": "Immortal", "ar": "الخالد", "es": "Inmortal", "nl": "Onsterfelijk"}',
  '🌟',
  25000,
  49999,
  '#FF6B9D',
  '[{"description": {"fr": "+50% bonus points", "en": "+50% bonus points", "ar": "+50% نقاط مكافأة", "es": "+50% puntos bonus", "nl": "+50% bonuspunten"}, "type": "bonus_points_pct", "value": 50}, {"description": {"fr": "Support white glove", "en": "White glove support", "ar": "الدعم الراقي", "es": "Soporte de lujo", "nl": "Luxe ondersteuning"}, "type": "white_glove_support", "value": 1}]'
),

(10,
  '{"fr": "Divin", "en": "Divine", "ar": "الإلهي", "es": "Divino", "nl": "Goddelijk"}',
  '🌈',
  50000,
  2147483647,
  '#FFFFFF',
  '[{"description": {"fr": "+100% bonus points", "en": "+100% bonus points", "ar": "+100% نقاط مكافأة", "es": "+100% puntos bonus", "nl": "+100% bonuspunten"}, "type": "bonus_points_pct", "value": 100}, {"description": {"fr": "Statut co-créateur de plateforme", "en": "Platform co-creator status", "ar": "حالة منشئ المنصة المشترك", "es": "Estado de cocreador de plataforma", "nl": "Status als medescheppende van platform"}, "type": "platform_cocreator", "value": 1}]'
);
