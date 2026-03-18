create extension if not exists pgcrypto;

set search_path = public;

-- 1) Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  subtitle text,
  data jsonb not null default '{}'::jsonb,
  points_delta integer,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_type_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_type_check
      check (type in ('points','challenge','tier_upgrade','badge','network','streak','system'));
  end if;
end $$;

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at)
  where read_at is null;

-- 2) User notification prefs table
create table if not exists public.user_notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  pref_points boolean not null default true,
  pref_challenges boolean not null default true,
  pref_tiers boolean not null default true,
  pref_merchants boolean not null default false,
  pref_streak boolean not null default true
);

-- 3) Main function: notify_user(userId, type, title, subtitle, data, pointsDelta)
create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_subtitle text default null,
  p_data jsonb default '{}'::jsonb,
  p_points_delta integer default null
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean := true;
  v_row public.notifications;
  v_prefs public.user_notification_prefs%rowtype;
begin
  if p_user_id is null then
    return null;
  end if;

  if p_type not in ('points','challenge','tier_upgrade','badge','network','streak','system') then
    raise exception 'notify_user: unsupported notification type %', p_type;
  end if;

  insert into public.user_notification_prefs (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
  into v_prefs
  from public.user_notification_prefs
  where user_id = p_user_id;

  if p_type = 'points' then
    v_allowed := coalesce(v_prefs.pref_points, true);
  elsif p_type = 'challenge' then
    v_allowed := coalesce(v_prefs.pref_challenges, true);
  elsif p_type = 'tier_upgrade' then
    v_allowed := coalesce(v_prefs.pref_tiers, true);
  elsif p_type = 'badge' then
    v_allowed := coalesce(v_prefs.pref_challenges, true);
  elsif p_type = 'network' then
    v_allowed := coalesce(v_prefs.pref_merchants, false);
  elsif p_type = 'streak' then
    v_allowed := coalesce(v_prefs.pref_streak, true);
  else
    v_allowed := true;
  end if;

  if not v_allowed then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, subtitle, data, points_delta)
  values (p_user_id, p_type, p_title, p_subtitle, coalesce(p_data, '{}'::jsonb), p_points_delta)
  returning * into v_row;

  return v_row;
end;
$$;

-- 4) Hook notify_user into existing functions/triggers

create or replace function public.process_qr_scan(
  p_merchant_id uuid,
  p_network_id uuid,
  p_user_id uuid
) returns json as $$
declare
  v_multiplier decimal := 1.0;
  v_base_points int;
  v_bonus_points int;
  v_total_points int;
  v_merchant_name text := 'Marchand';
  v_network_name text := 'Reseau LoyalUp';
  v_user_total int := 0;
  v_next_threshold int := 1000;
begin
  if to_regclass('public.merchant_networks') is not null then
    begin
      execute '
        select coalesce(multiplier, 1.0)
        from public.merchant_networks
        where merchant_id = $1 and network_id = $2
        limit 1
      '
      into v_multiplier
      using p_merchant_id, p_network_id;
    exception when undefined_column then
      null;
    end;
  end if;

  if v_multiplier is null or v_multiplier <= 0 then
    v_multiplier := 1.0;
  end if;

  if v_multiplier = 1.0 and to_regclass('public.network_members') is not null then
    begin
      select coalesce(n.points_multiplier, 1.0)
      into v_multiplier
      from public.network_members nm
      join public.networks n on n.id = nm.network_id
      where nm.fournisseur_id = p_merchant_id
        and nm.network_id = p_network_id
        and nm.status = 'active'
      limit 1;
    exception when undefined_table then
      null;
    end;
  end if;

  if v_multiplier is null or v_multiplier <= 0 then
    v_multiplier := 1.0;
  end if;

  v_base_points := 75;
  v_bonus_points := round(v_base_points * (v_multiplier - 1));
  v_total_points := v_base_points + v_bonus_points;

  if to_regclass('public.transactions') is not null then
    begin
      insert into public.transactions (
        pending_transaction_id,
        client_id,
        fournisseur_id,
        service_id,
        montant,
        points_credited,
        status
      )
      values (
        gen_random_uuid(),
        p_user_id,
        p_merchant_id,
        null,
        0,
        v_total_points,
        'validated'
      );
    exception when undefined_column then
      null;
    end;
  end if;

  if to_regclass('public.qr_scans') is not null then
    begin
      execute '
        insert into public.qr_scans (user_id, merchant_id, network_id, points_earned, status)
        values ($1, $2, $3, $4, ''success'')
      '
      using p_user_id, p_merchant_id, p_network_id, v_total_points;
    exception when undefined_column then
      null;
    end;
  end if;

  if to_regclass('public.users') is not null then
    begin
      execute '
        update public.users
        set total_points = coalesce(total_points, 0) + $1
        where id = $2
        returning total_points
      '
      into v_user_total
      using v_total_points, p_user_id;
    exception when undefined_column then
      null;
    end;
  end if;

  if (v_user_total is null or v_user_total = 0) and to_regclass('public.client_levels') is not null then
    insert into public.client_levels (client_id, xp_total)
    values (p_user_id, v_total_points)
    on conflict (client_id)
    do update set xp_total = public.client_levels.xp_total + excluded.xp_total
    returning xp_total into v_user_total;
  end if;

  if v_user_total is null then
    v_user_total := v_total_points;
  end if;

  if to_regclass('public.merchants') is not null then
    begin
      execute 'select name from public.merchants where id = $1 limit 1'
      into v_merchant_name
      using p_merchant_id;
    exception when undefined_column then
      null;
    end;
  end if;

  if (v_merchant_name is null or v_merchant_name = 'Marchand') and to_regclass('public.fournisseurs') is not null then
    select coalesce(nom_commerce, 'Marchand')
    into v_merchant_name
    from public.fournisseurs
    where id = p_merchant_id
    limit 1;
  end if;

  if to_regclass('public.networks') is not null then
    begin
      select coalesce(
        case
          when jsonb_typeof(name) = 'object' then coalesce(name->>'fr', name->>'en', 'Reseau LoyalUp')
          when jsonb_typeof(name) = 'string' then trim(both '"' from name::text)
          else 'Reseau LoyalUp'
        end,
        'Reseau LoyalUp'
      )
      into v_network_name
      from public.networks
      where id = p_network_id
      limit 1;
    exception when undefined_column then
      null;
    end;
  end if;

  if to_regclass('public.tiers') is not null then
    begin
      execute '
        select min_points
        from public.tiers
        where min_points > $1
        order by min_points asc
        limit 1
      '
      into v_next_threshold
      using v_user_total;
    exception when undefined_column then
      null;
    end;
  end if;

  if (v_next_threshold is null or v_next_threshold <= 0) and to_regclass('public.level_definitions') is not null then
    select min_xp
    into v_next_threshold
    from public.level_definitions
    where min_xp > v_user_total
    order by min_xp asc
    limit 1;
  end if;

  if v_next_threshold is null or v_next_threshold <= 0 then
    v_next_threshold := v_user_total;
  end if;

  perform public.notify_user(
    p_user_id,
    'points',
    format('+%s pts', v_total_points),
    v_merchant_name,
    '{}'::jsonb,
    v_total_points
  );

  return json_build_object(
    'points', v_total_points,
    'basePoints', v_base_points,
    'bonusPoints', v_bonus_points,
    'multiplier', v_multiplier,
    'merchantName', v_merchant_name,
    'networkName', v_network_name,
    'userTotalPoints', v_user_total,
    'nextTierThreshold', v_next_threshold
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.trg_check_tier_upgrade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_tier_id uuid;
  v_old_tier_id uuid;
  v_new_tier_name text;
  v_old_tier_name text;
  v_total_points integer;
  v_user_id uuid;
begin
  v_total_points := nullif(to_jsonb(new) ->> 'total_points', '')::integer;
  v_user_id := nullif(to_jsonb(new) ->> 'id', '')::uuid;
  v_old_tier_id := nullif(to_jsonb(old) ->> 'tier_id', '')::uuid;

  if v_total_points is null or v_user_id is null or to_regclass('public.tiers') is null then
    return new;
  end if;

  begin
    select t.id,
           coalesce(t.name::text, 'Tier')
    into v_new_tier_id, v_new_tier_name
    from public.tiers t
    where t.min_points <= v_total_points
    order by t.min_points desc
    limit 1;
  exception when undefined_column then
    return new;
  end;

  if v_new_tier_id is null or v_new_tier_id = v_old_tier_id then
    return new;
  end if;

  begin
    select coalesce(t.name::text, 'Tier')
    into v_old_tier_name
    from public.tiers t
    where t.id = v_old_tier_id;
  exception when undefined_column then
    v_old_tier_name := null;
  end;

  begin
    update public.users
    set tier_id = v_new_tier_id
    where id = v_user_id;
  exception when undefined_column then
    return new;
  end;

  if to_regclass('public.tier_history') is not null then
    insert into public.tier_history (user_id, old_tier, new_tier, upgraded_at)
    values (v_user_id, v_old_tier_id, v_new_tier_id, now());
  end if;

  perform public.notify_user(
    v_user_id,
    'tier_upgrade',
    format('Niveau %s atteint !', coalesce(nullif(v_new_tier_name, ''), 'suivant')),
    coalesce(
      case when v_old_tier_name is null then null else format('Ancien niveau: %s', v_old_tier_name) end,
      format('Total points: %s', coalesce(v_total_points, 0))
    ),
    jsonb_build_object(
      'old_tier_id', v_old_tier_id,
      'new_tier_id', v_new_tier_id,
      'old_tier_name', v_old_tier_name,
      'new_tier_name', v_new_tier_name,
      'total_points', v_total_points
    ),
    null
  );

  return new;
end;
$$;

create or replace function public.check_badge_unlock(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx_count integer := 0;
  v_streak integer := 0;
  v_network_count integer := 0;
  v_tier_metric integer := 0;
  v_row record;
  v_user_badges_exists boolean := false;
  v_client_badges_exists boolean := false;
  v_unlocked boolean := false;
  v_badge_name text;
begin
  if to_regclass('public.badge_conditions') is null then
    return;
  end if;

  if to_regclass('public.transactions') is not null then
    begin
      execute $sql$
        select count(*)::int
        from public.transactions
        where coalesce(client_id, user_id) = $1
      $sql$
      into v_tx_count
      using p_user_id;
    exception when undefined_column then
      begin
        execute 'select count(*)::int from public.transactions where client_id = $1'
        into v_tx_count
        using p_user_id;
      exception when undefined_column then
        execute 'select count(*)::int from public.transactions where user_id = $1'
        into v_tx_count
        using p_user_id;
      end;
    end;
  end if;

  if to_regclass('public.user_streaks') is not null then
    select coalesce(streak_days, 0)
    into v_streak
    from public.user_streaks
    where user_id = p_user_id;
  elsif to_regclass('public.client_streaks') is not null then
    select coalesce(current_streak, 0)
    into v_streak
    from public.client_streaks
    where client_id = p_user_id
      and fournisseur_id is null;
  end if;

  if to_regclass('public.user_networks') is not null then
    select count(*)::int
    into v_network_count
    from public.user_networks
    where user_id = p_user_id;
  elsif to_regclass('public.network_clients') is not null then
    select count(*)::int
    into v_network_count
    from public.network_clients
    where client_id = p_user_id;
  end if;

  if to_regclass('public.users') is not null and to_regclass('public.tiers') is not null then
    begin
      select coalesce(t.min_points, 0)
      into v_tier_metric
      from public.users u
      left join public.tiers t on t.id = u.tier_id
      where u.id = p_user_id;
    exception when undefined_column then
      v_tier_metric := 0;
    end;
  end if;

  v_user_badges_exists := to_regclass('public.user_badges') is not null;
  v_client_badges_exists := to_regclass('public.client_badges') is not null;

  for v_row in
    select bc.id, bc.badge_id, bc.condition_type, bc.threshold
    from public.badge_conditions bc
    order by bc.created_at asc
  loop
    v_unlocked := false;

    if v_user_badges_exists then
      execute 'select exists(select 1 from public.user_badges where user_id = $1 and badge_id = $2)'
      into v_unlocked
      using p_user_id, v_row.badge_id;
    elsif v_client_badges_exists then
      execute 'select exists(select 1 from public.client_badges where client_id = $1 and badge_id = $2)'
      into v_unlocked
      using p_user_id, v_row.badge_id;
    end if;

    if v_unlocked then
      continue;
    end if;

    if (
      (v_row.condition_type = 'transaction_count' and v_tx_count >= v_row.threshold)
      or (v_row.condition_type = 'streak' and v_streak >= v_row.threshold)
      or (v_row.condition_type = 'tier' and v_tier_metric >= v_row.threshold)
      or (v_row.condition_type = 'network_count' and v_network_count >= v_row.threshold)
    ) then
      if v_user_badges_exists then
        execute $sql$
          insert into public.user_badges (user_id, badge_id, unlocked_at)
          values ($1, $2, now())
          on conflict do nothing
        $sql$
        using p_user_id, v_row.badge_id;
      elsif v_client_badges_exists then
        insert into public.client_badges (client_id, badge_id, unlocked_at, notified)
        values (p_user_id, v_row.badge_id, now(), false)
        on conflict (client_id, badge_id) do nothing;
      end if;

      v_badge_name := null;
      if to_regclass('public.badge_definitions') is not null then
        begin
          select coalesce(
            case
              when jsonb_typeof(name) = 'object' then coalesce(name->>'fr', name->>'en')
              when jsonb_typeof(name) = 'string' then trim(both '"' from name::text)
              else null
            end,
            code,
            'Badge'
          )
          into v_badge_name
          from public.badge_definitions
          where id = v_row.badge_id
          limit 1;
        exception when undefined_column then
          v_badge_name := 'Badge';
        end;
      end if;

      perform public.notify_user(
        p_user_id,
        'badge',
        format('Badge debloque : %s', coalesce(v_badge_name, 'Badge')),
        'Nouvelle recompense disponible.',
        jsonb_build_object(
          'badge_id', v_row.badge_id,
          'condition_type', v_row.condition_type,
          'threshold', v_row.threshold
        ),
        null
      );
    end if;
  end loop;
end;
$$;

create or replace function public.trg_update_user_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_tx_type text := nullif(to_jsonb(new) ->> 'type', '');
  v_tx_at timestamptz := coalesce((to_jsonb(new) ->> 'created_at')::timestamptz, now());
  v_today date := (coalesce((to_jsonb(new) ->> 'created_at')::timestamptz, now()))::date;
  v_current record;
  v_new_streak integer := 1;
  v_should_notify boolean := false;
begin
  if v_tx_type = 'challenge_reward' then
    return new;
  end if;

  v_user_id := coalesce(
    nullif(to_jsonb(new) ->> 'user_id', '')::uuid,
    nullif(to_jsonb(new) ->> 'client_id', '')::uuid
  );

  if v_user_id is null then
    return new;
  end if;

  if to_regclass('public.user_streaks') is not null then
    select user_id, streak_days, last_activity
    into v_current
    from public.user_streaks
    where user_id = v_user_id
    for update;

    if found then
      if v_current.last_activity::date = (v_today - interval '1 day')::date then
        v_new_streak := coalesce(v_current.streak_days, 0) + 1;
        v_should_notify := true;
      elsif v_current.last_activity::date = v_today then
        v_new_streak := coalesce(v_current.streak_days, 0);
      else
        v_new_streak := 1;
        v_should_notify := true;
      end if;

      update public.user_streaks
      set streak_days = v_new_streak,
          last_activity = v_tx_at,
          updated_at = now()
      where user_id = v_user_id;
    else
      insert into public.user_streaks (user_id, streak_days, last_activity)
      values (v_user_id, 1, v_tx_at)
      on conflict (user_id) do update
      set streak_days = excluded.streak_days,
          last_activity = excluded.last_activity,
          updated_at = now();

      v_new_streak := 1;
      v_should_notify := true;
    end if;
  end if;

  if to_regclass('public.client_streaks') is not null then
    insert into public.client_streaks (client_id, fournisseur_id, current_streak, longest_streak, last_visit_date, updated_at)
    values (v_user_id, null, greatest(v_new_streak, 1), greatest(v_new_streak, 1), v_today, now())
    on conflict (client_id, fournisseur_id)
    do update set
      current_streak = case
        when public.client_streaks.last_visit_date = (excluded.last_visit_date - interval '1 day')::date
          then public.client_streaks.current_streak + 1
        when public.client_streaks.last_visit_date = excluded.last_visit_date
          then public.client_streaks.current_streak
        else 1
      end,
      longest_streak = greatest(
        public.client_streaks.longest_streak,
        case
          when public.client_streaks.last_visit_date = (excluded.last_visit_date - interval '1 day')::date
            then public.client_streaks.current_streak + 1
          when public.client_streaks.last_visit_date = excluded.last_visit_date
            then public.client_streaks.current_streak
          else 1
        end
      ),
      last_visit_date = excluded.last_visit_date,
      updated_at = now();
  end if;

  if v_should_notify then
    perform public.notify_user(
      v_user_id,
      'streak',
      format('Streak %s jours !', v_new_streak),
      'Continuez comme ca.',
      jsonb_build_object('streak_days', v_new_streak),
      null
    );
  end if;

  return new;
end;
$$;

create or replace function public.trg_check_challenge_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row record;
  v_new_progress numeric;
  v_completed boolean;
  v_challenge_name text;
begin
  v_user_id := coalesce(
    nullif(to_jsonb(new) ->> 'user_id', '')::uuid,
    nullif(to_jsonb(new) ->> 'client_id', '')::uuid
  );

  if v_user_id is null then
    return new;
  end if;

  if to_regclass('public.user_challenges') is not null then
    for v_row in
      select uc.id, uc.challenge_id, uc.progress, uc.target
      from public.user_challenges uc
      where uc.user_id = v_user_id
        and uc.status = 'active'
    loop
      v_new_progress := coalesce(v_row.progress, 0) + 1;
      v_completed := v_new_progress >= coalesce(v_row.target, 0);

      update public.user_challenges
      set progress = v_new_progress,
          status = case when v_completed then 'completed' else status end,
          completed_at = case when v_completed then now() else completed_at end
      where id = v_row.id;

      if v_completed then
        perform public.award_challenge_points(v_user_id, v_row.challenge_id);
        perform public.check_badge_unlock(v_user_id);

        v_challenge_name := null;
        if to_regclass('public.challenges') is not null then
          begin
            select coalesce(title, name, 'Defi')
            into v_challenge_name
            from public.challenges
            where id = v_row.challenge_id
            limit 1;
          exception when undefined_column then
            v_challenge_name := 'Defi';
          end;
        end if;

        perform public.notify_user(
          v_user_id,
          'challenge',
          'Defi complete !',
          coalesce(v_challenge_name, 'Votre progression a ete mise a jour.'),
          jsonb_build_object('challenge_id', v_row.challenge_id),
          null
        );
      end if;
    end loop;
  elsif to_regclass('public.client_challenge_progress') is not null and to_regclass('public.challenges') is not null then
    for v_row in
      select cp.id,
             cp.challenge_id,
             cp.current_value,
             cp.completed,
             ch.target_value
      from public.client_challenge_progress cp
      join public.challenges ch on ch.id = cp.challenge_id
      where cp.client_id = v_user_id
        and cp.completed = false
        and ch.is_active = true
        and ch.ends_at >= now()
    loop
      v_new_progress := coalesce(v_row.current_value, 0) + 1;
      v_completed := v_new_progress >= coalesce(v_row.target_value, 0);

      update public.client_challenge_progress
      set current_value = v_new_progress,
          completed = v_completed,
          completed_at = case when v_completed then now() else completed_at end
      where id = v_row.id;

      if v_completed then
        perform public.award_challenge_points(v_user_id, v_row.challenge_id);
        perform public.check_badge_unlock(v_user_id);

        perform public.notify_user(
          v_user_id,
          'challenge',
          'Defi complete !',
          'Votre progression a ete mise a jour.',
          jsonb_build_object('challenge_id', v_row.challenge_id),
          null
        );
      end if;
    end loop;
  end if;

  return new;
end;
$$;

-- 5) RLS policies on notifications
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update_read_own on public.notifications;
create policy notifications_update_read_own
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- No INSERT policy: inserts are expected through SECURITY DEFINER function(s)
revoke insert on public.notifications from anon, authenticated;
revoke delete on public.notifications from anon, authenticated;
revoke update on public.notifications from anon;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant select, update on public.user_notification_prefs to authenticated;
grant execute on function public.notify_user(uuid, text, text, text, jsonb, integer) to authenticated;
