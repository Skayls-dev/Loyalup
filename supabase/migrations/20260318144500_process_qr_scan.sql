CREATE OR REPLACE FUNCTION public.process_qr_scan(
  p_merchant_id UUID,
  p_network_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_multiplier DECIMAL := 1.0;
  v_base_points INT;
  v_bonus_points INT;
  v_total_points INT;
  v_merchant_name TEXT := 'Marchand';
  v_network_name TEXT := 'Reseau LoyalUp';
  v_user_total INT := 0;
  v_next_threshold INT := 1000;
BEGIN
  -- Get network multiplier for this merchant.
  -- Primary path: merchant_networks table if it exists.
  IF to_regclass('public.merchant_networks') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        SELECT COALESCE(multiplier, 1.0)
        FROM public.merchant_networks
        WHERE merchant_id = $1 AND network_id = $2
        LIMIT 1
      '
      INTO v_multiplier
      USING p_merchant_id, p_network_id;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  -- Fallback path with existing schema: network_members + networks.points_multiplier.
  IF v_multiplier IS NULL OR v_multiplier <= 0 THEN
    v_multiplier := 1.0;
  END IF;

  IF v_multiplier = 1.0 AND to_regclass('public.network_members') IS NOT NULL THEN
    BEGIN
      SELECT COALESCE(n.points_multiplier, 1.0)
      INTO v_multiplier
      FROM public.network_members nm
      JOIN public.networks n ON n.id = nm.network_id
      WHERE nm.fournisseur_id = p_merchant_id
        AND nm.network_id = p_network_id
        AND nm.status = 'active'
      LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END IF;

  IF v_multiplier IS NULL OR v_multiplier <= 0 THEN
    v_multiplier := 1.0;
  END IF;

  -- Base points: fixed value from current product rule.
  v_base_points := 75;
  v_bonus_points := ROUND(v_base_points * (v_multiplier - 1));
  v_total_points := v_base_points + v_bonus_points;

  -- Insert transaction in the current schema table.
  IF to_regclass('public.transactions') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.transactions (
        pending_transaction_id,
        client_id,
        fournisseur_id,
        service_id,
        montant,
        points_credited,
        status
      )
      VALUES (
        gen_random_uuid(),
        p_user_id,
        p_merchant_id,
        NULL,
        0,
        v_total_points,
        'validated'
      );
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  -- Insert scan log when qr_scans exists.
  IF to_regclass('public.qr_scans') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        INSERT INTO public.qr_scans (user_id, merchant_id, network_id, points_earned, status)
        VALUES ($1, $2, $3, $4, ''success'')
      '
      USING p_user_id, p_merchant_id, p_network_id, v_total_points;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  -- Update user points.
  -- Preferred legacy path: users.total_points
  IF to_regclass('public.users') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        UPDATE public.users
        SET total_points = COALESCE(total_points, 0) + $1
        WHERE id = $2
        RETURNING total_points
      '
      INTO v_user_total
      USING v_total_points, p_user_id;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  -- Current schema fallback: client_levels.xp_total
  IF (v_user_total IS NULL OR v_user_total = 0) AND to_regclass('public.client_levels') IS NOT NULL THEN
    INSERT INTO public.client_levels (client_id, xp_total)
    VALUES (p_user_id, v_total_points)
    ON CONFLICT (client_id)
    DO UPDATE SET xp_total = public.client_levels.xp_total + EXCLUDED.xp_total
    RETURNING xp_total INTO v_user_total;
  END IF;

  IF v_user_total IS NULL THEN
    v_user_total := v_total_points;
  END IF;

  -- Get merchant name (merchants table first, then fournisseurs fallback).
  IF to_regclass('public.merchants') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT name FROM public.merchants WHERE id = $1 LIMIT 1'
      INTO v_merchant_name
      USING p_merchant_id;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  IF (v_merchant_name IS NULL OR v_merchant_name = 'Marchand') AND to_regclass('public.fournisseurs') IS NOT NULL THEN
    SELECT COALESCE(nom_commerce, 'Marchand')
    INTO v_merchant_name
    FROM public.fournisseurs
    WHERE id = p_merchant_id
    LIMIT 1;
  END IF;

  -- Get network name from networks.name (jsonb or text).
  IF to_regclass('public.networks') IS NOT NULL THEN
    BEGIN
      SELECT COALESCE(
        CASE
          WHEN jsonb_typeof(name) = 'object' THEN COALESCE(name->>'fr', name->>'en', 'Reseau LoyalUp')
          WHEN jsonb_typeof(name) = 'string' THEN trim(both '"' from name::text)
          ELSE 'Reseau LoyalUp'
        END,
        'Reseau LoyalUp'
      )
      INTO v_network_name
      FROM public.networks
      WHERE id = p_network_id
      LIMIT 1;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  -- Get next tier threshold.
  -- Preferred legacy path: tiers.min_points
  IF to_regclass('public.tiers') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        SELECT min_points
        FROM public.tiers
        WHERE min_points > $1
        ORDER BY min_points ASC
        LIMIT 1
      '
      INTO v_next_threshold
      USING v_user_total;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  -- Current schema fallback: level_definitions.min_xp
  IF (v_next_threshold IS NULL OR v_next_threshold <= 0) AND to_regclass('public.level_definitions') IS NOT NULL THEN
    SELECT min_xp
    INTO v_next_threshold
    FROM public.level_definitions
    WHERE min_xp > v_user_total
    ORDER BY min_xp ASC
    LIMIT 1;
  END IF;

  IF v_next_threshold IS NULL OR v_next_threshold <= 0 THEN
    v_next_threshold := v_user_total;
  END IF;

  RETURN json_build_object(
    'points', v_total_points,
    'basePoints', v_base_points,
    'bonusPoints', v_bonus_points,
    'multiplier', v_multiplier,
    'merchantName', v_merchant_name,
    'networkName', v_network_name,
    'userTotalPoints', v_user_total,
    'nextTierThreshold', v_next_threshold
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
