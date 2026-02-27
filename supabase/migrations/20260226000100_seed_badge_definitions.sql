-- Week 10 Seed: Badge Definitions
-- All badges with proper i18n support

INSERT INTO badge_definitions (code, name, description, emoji, category, rarity, trigger_type, trigger_value, is_active, is_secret, points_reward) VALUES

-- MILESTONE BADGES (common)
('first_scan', 
  '{"fr": "Premier scan", "en": "First Scan", "ar": "الفحص الأول", "es": "Primer Escaneo", "nl": "Eerste Scan"}',
  '{"fr": "Effectuez votre premier scan", "en": "Make your first scan", "ar": "أجرِ فحصك الأول", "es": "Haz tu primer escaneo", "nl": "Voer je eerste scan uit"}',
  '🔍', 'milestone', 'common', 'transaction_count', 1, true, false, 0),

('loyal_5',
  '{"fr": "Fidèle x5", "en": "Loyal x5", "ar": "مولى x5", "es": "Leal x5", "nl": "Trouw x5"}',
  '{"fr": "Effectuez 5 transactions", "en": "Make 5 transactions", "ar": "أجرِ 5 معاملات", "es": "Realiza 5 transacciones", "nl": "Voer 5 transacties uit"}',
  '⭐', 'milestone', 'common', 'transaction_count', 5, true, false, 0),

('loyal_10',
  '{"fr": "Loyal x10", "en": "Loyal x10", "ar": "مولى x10", "es": "Leal x10", "nl": "Trouw x10"}',
  '{"fr": "Effectuez 10 transactions", "en": "Make 10 transactions", "ar": "أجرِ 10 معاملات", "es": "Realiza 10 transacciones", "nl": "Voer 10 transacties uit"}',
  '🌟', 'milestone', 'common', 'transaction_count', 10, true, false, 0),

('loyal_50',
  '{"fr": "Super Loyal", "en": "Super Loyal", "ar": "مولى فائق", "es": "Super Leal", "nl": "Super Trouw"}',
  '{"fr": "Effectuez 50 transactions", "en": "Make 50 transactions", "ar": "أجرِ 50 معاملة", "es": "Realiza 50 transacciones", "nl": "Voer 50 transacties uit"}',
  '💫', 'milestone', 'rare', 'transaction_count', 50, true, false, 0),

('loyal_100',
  '{"fr": "Légende", "en": "Legend", "ar": "أسطورة", "es": "Leyenda", "nl": "Legende"}',
  '{"fr": "Effectuez 100 transactions", "en": "Make 100 transactions", "ar": "أجرِ 100 معاملة", "es": "Realiza 100 transacciones", "nl": "Voer 100 transacties uit"}',
  '👑', 'milestone', 'legendary', 'transaction_count', 100, true, false, 0),

-- POINTS BADGES (common → rare)
('century',
  '{"fr": "100 points", "en": "Century", "ar": "100 نقطة", "es": "Centenar", "nl": "Honderd"}',
  '{"fr": "Gagnez 100 points", "en": "Earn 100 points", "ar": "احصل على 100 نقطة", "es": "Gana 100 puntos", "nl": "Verdien 100 punten"}',
  '💯', 'points', 'common', 'points_total', 100, true, false, 0),

('high_roller',
  '{"fr": "1000 points", "en": "High Roller", "ar": "1000 نقطة", "es": "Jugador Fuerte", "nl": "Hoge Roller"}',
  '{"fr": "Gagnez 1000 points", "en": "Earn 1000 points", "ar": "احصل على 1000 نقطة", "es": "Gana 1000 puntos", "nl": "Verdien 1000 punten"}',
  '💰', 'points', 'rare', 'points_total', 1000, true, false, 0),

('whale',
  '{"fr": "10000 points", "en": "Whale", "ar": "10000 نقطة", "es": "Ballena", "nl": "Walvis"}',
  '{"fr": "Gagnez 10000 points", "en": "Earn 10000 points", "ar": "احصل على 10000 نقطة", "es": "Gana 10000 puntos", "nl": "Verdien 10000 punten"}',
  '🐋', 'points', 'epic', 'points_total', 10000, true, false, 0),

-- SOCIAL BADGES (rare)
('first_referral',
  '{"fr": "Ambassadeur", "en": "Ambassador", "ar": "السفير", "es": "Embajador", "nl": "Ambassadeur"}',
  '{"fr": "Parrainer 1 ami", "en": "Refer 1 friend", "ar": "رشح صديق واحد", "es": "Refiere a 1 amigo", "nl": "Nodig 1 vriend uit"}',
  '🤝', 'social', 'rare', 'referral_count', 1, true, false, 0),

('squad_goals',
  '{"fr": "Squad Goals", "en": "Squad Goals", "ar": "أهداف الفريق", "es": "Objetivos del Escuadrón", "nl": "Groepsdoelen"}',
  '{"fr": "Parrainer 5 amis", "en": "Refer 5 friends", "ar": "رشح 5 أصدقاء", "es": "Refiere a 5 amigos", "nl": "Nodig 5 vrienden uit"}',
  '👥', 'social', 'rare', 'referral_count', 5, true, false, 0),

('super_referrer',
  '{"fr": "Super Recruteur", "en": "Super Referrer", "ar": "موصي فائق", "es": "Super Padrino", "nl": "Super Referrer"}',
  '{"fr": "Parrainer 10 amis", "en": "Refer 10 friends", "ar": "رشح 10 أصدقاء", "es": "Refiere a 10 amigos", "nl": "Nodig 10 vrienden uit"}',
  '🚀', 'social', 'epic', 'referral_count', 10, true, false, 0),

-- EXPLORER BADGES (rare → epic)
('duo',
  '{"fr": "Duo", "en": "Duo", "ar": "ثنائي", "es": "Dúo", "nl": "Duo"}',
  '{"fr": "Visiter 2 commerces", "en": "Visit 2 shops", "ar": "زر متجرين", "es": "Visita 2 tiendas", "nl": "Bezoek 2 winkels"}',
  '🎯', 'explorer', 'common', 'provider_count', 2, true, false, 0),

('trio',
  '{"fr": "Explorateur", "en": "Explorer", "ar": "المستكشف", "es": "Explorador", "nl": "Ontdekker"}',
  '{"fr": "Visiter 3 commerces", "en": "Visit 3 shops", "ar": "زر 3 متاجر", "es": "Visita 3 tiendas", "nl": "Bezoek 3 winkels"}',
  '🗺', 'explorer', 'common', 'provider_count', 3, true, false, 0),

('nomad',
  '{"fr": "Nomade", "en": "Nomad", "ar": "بدوي", "es": "Nómada", "nl": "Nomade"}',
  '{"fr": "Visiter 5 commerces", "en": "Visit 5 shops", "ar": "زر 5 متاجر", "es": "Visita 5 tiendas", "nl": "Bezoek 5 winkels"}',
  '✈️', 'explorer', 'rare', 'provider_count', 5, true, false, 0),

('citizen',
  '{"fr": "Grand Citoyen", "en": "Grand Citizen", "ar": "مواطن عظيم", "es": "Gran Ciudadano", "nl": "Grote Burger"}',
  '{"fr": "Visiter 10 commerces", "en": "Visit 10 shops", "ar": "زر 10 متاجر", "es": "Visita 10 tiendas", "nl": "Bezoek 10 winkels"}',
  '🌆', 'explorer', 'epic', 'provider_count', 10, true, false, 0),

-- STREAK BADGES (rare → epic)
('streak_7',
  '{"fr": "7 jours de suite", "en": "7 Day Streak", "ar": "7 أيام متتالية", "es": "Racha de 7 Días", "nl": "7 Dagen Achter Elkaar"}',
  '{"fr": "Scanner 7 jours consécutifs", "en": "Scan 7 days in a row", "ar": "امسح 7 أيام متتالية", "es": "Escanea 7 días seguidos", "nl": "Scan 7 dagen achter elkaar"}',
  '🔥', 'streak', 'rare', 'streak_days', 7, true, false, 0),

('streak_30',
  '{"fr": "Mois parfait", "en": "Perfect Month", "ar": "شهر مثالي", "es": "Mes Perfecto", "nl": "Perfecte Maand"}',
  '{"fr": "Scanner 30 jours consécutifs", "en": "Scan 30 days in a row", "ar": "امسح 30 يومًا متتاليًا", "es": "Escanea 30 días seguidos", "nl": "Scan 30 dagen achter elkaar"}',
  '🏆', 'streak', 'epic', 'streak_days', 30, true, false, 0),

('streak_100',
  '{"fr": "Centurion", "en": "Centurion", "ar": "قائد مائة", "es": "Centurión", "nl": "Centurio"}',
  '{"fr": "Scanner 100 jours consécutifs", "en": "Scan 100 days in a row", "ar": "امسح 100 يوم متتالي", "es": "Escanea 100 días seguidos", "nl": "Scan 100 dagen achter elkaar"}',
  '⚡', 'streak', 'legendary', 'streak_days', 100, true, false, 0),

-- MARKETPLACE BADGES (rare)
('first_transfer',
  '{"fr": "Globe Trotter", "en": "Globe Trotter", "ar": "مسافر حول العالم", "es": "Trotamundos", "nl": "Globetrotter"}',
  '{"fr": "Transférer des points", "en": "Transfer points", "ar": "نقل نقاط", "es": "Transferir puntos", "nl": "Punten overdragen"}',
  '🌐', 'marketplace', 'rare', 'transfer_count', 1, true, false, 0),

('trader',
  '{"fr": "Trader", "en": "Trader", "ar": "التاجر", "es": "Operador", "nl": "Handelaar"}',
  '{"fr": "Transférer des points 10 fois", "en": "Transfer points 10 times", "ar": "انقل النقاط 10 مرات", "es": "Transfiere puntos 10 veces", "nl": "Punten 10 keer overdragen"}',
  '💱', 'marketplace', 'rare', 'transfer_count', 10, true, false, 0),

-- SECRET BADGES (hidden until unlocked, epic)
('night_owl',
  '{"fr": "Oiseau de Nuit", "en": "Night Owl", "ar": "بومة الليل", "es": "Búho Nocturno", "nl": "Nachtuil"}',
  '{"fr": "Scanner entre 23h-01h", "en": "Scan between 11pm-1am", "ar": "امسح بين 23:00-01:00", "es": "Escanea entre las 23h-01h", "nl": "Scan tussen 23u-01u"}',
  '🌙', 'secret', 'epic', 'manual', null, true, true, 0),

('early_bird',
  '{"fr": "Lève-tôt", "en": "Early Bird", "ar": "الطائر المبكر", "es": "Madrugador", "nl": "Vroege Vogel"}',
  '{"fr": "Scanner avant 07h00", "en": "Scan before 7am", "ar": "امسح قبل الساعة 7 صباحًا", "es": "Escanea antes de las 7am", "nl": "Scan voor 07u"}',
  '🌅', 'secret', 'epic', 'manual', null, true, true, 0),

('weekend_warrior',
  '{"fr": "Guerrier du Weekend", "en": "Weekend Warrior", "ar": "محارب نهاية الأسبوع", "es": "Guerrero del Fin de Semana", "nl": "Weekendkrijger"}',
  '{"fr": "Scannez 10x le weekend", "en": "Scan 10x on weekends", "ar": "امسح 10 مرات في نهاية الأسبوع", "es": "Escanea 10 veces el fin de semana", "nl": "Scan 10x in het weekend"}',
  '⛱️', 'secret', 'epic', 'manual', null, true, true, 0),

('big_spender',
  '{"fr": "Grand Dépensier", "en": "Big Spender", "ar": "منفق كبير", "es": "Gran Gastador", "nl": "Grote Uitgever"}',
  '{"fr": "Transaction unique > 100€", "en": "Single transaction > €100", "ar": "معاملة واحدة > 100€", "es": "Transacción individual > 100€", "nl": "Enkele transactie > 100€"}',
  '💸', 'secret', 'epic', 'manual', null, true, true, 0);
