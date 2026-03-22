create extension if not exists pgcrypto;

set search_path = public;

create table if not exists public.user_streaks (
  user_id uuid primary key,
  streak_days integer not null default 0,
  last_activity timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tier_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  old_tier uuid,
  new_tier uuid,
  upgraded_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.badge_conditions (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null,
  condition_type text not null check (condition_type in ('transaction_count', 'streak', 'tier', 'network_count')),
  threshold integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_streaks_user_id on public.user_streaks (user_id);
create index if not exists idx_tier_history_user_id on public.tier_history (user_id, upgraded_at desc);
create index if not exists idx_notifications_user_id on public.notifications (user_id, created_at desc);
create index if not exists idx_badge_conditions_badge_id on public.badge_conditions (badge_id, condition_type);

do $$
begin
  if to_regclass('public.user_badges') is not null then
    execute 'create index if not exists idx_user_badges_user_id on public.user_badges (user_id, unlocked_at desc)';
  end if;

  if to_regclass('public.user_challenges') is not null then
    execute 'create index if not exists idx_user_challenges_user_id on public.user_challenges (user_id, status)';
  end if;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_streaks_touch_updated_at on public.user_streaks;
create trigger trg_user_streaks_touch_updated_at
before update on public.user_streaks
for each row
execute function public.touch_updated_at();

create or replace function public.award_challenge_points(p_user_id uuid, p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward_points integer := 0;
  v_fournisseur_id uuid := null;
  v_has_modern_tx_columns boolean := false;
  v_has_xp_transactions boolean := false;
begin
  if to_regclass('public.challenges') is null then
    return;
  end if;

  select coalesce(c.reward_points, 0), c.fournisseur_id
  into v_reward_points, v_fournisseur_id
  from public.challenges c
  where c.id = p_challenge_id;

  if v_reward_points <= 0 then
    return;
  end if;

  if to_regclass('public.users') is not null then
    begin
      update public.users
      set total_points = coalesce(total_points, 0) + v_reward_points
      where id = p_user_id;
    exception when undefined_column then
      null;
    end;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'type'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'points'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'user_id'
  )
  into v_has_modern_tx_columns;

  v_has_xp_transactions := to_regclass('public.xp_transactions') is not null;

  if v_has_modern_tx_columns then
    execute $sql$
      insert into public.transactions (type, points, user_id, created_at)
      values ('challenge_reward', $1, $2, now())
    $sql$
    using v_reward_points, p_user_id;
  elsif v_has_xp_transactions then
    insert into public.xp_transactions (client_id, xp_amount, source, reference_id, created_at)
    values (p_user_id, v_reward_points, 'challenge', p_challenge_id, now());
  end if;
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

      insert into public.notifications (user_id, type, data)
      values (
        p_user_id,
        'badge_unlock',
        jsonb_build_object('badge_id', v_row.badge_id, 'condition_type', v_row.condition_type, 'threshold', v_row.threshold)
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
      elsif v_current.last_activity::date = v_today then
        v_new_streak := coalesce(v_current.streak_days, 0);
      else
        v_new_streak := 1;
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

  return new;
end;
$$;

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

  insert into public.tier_history (user_id, old_tier, new_tier, upgraded_at)
  values (v_user_id, v_old_tier_id, v_new_tier_id, now());

  insert into public.notifications (user_id, type, data)
  values (
    v_user_id,
    'tier_upgrade',
    jsonb_build_object(
      'old_tier_id', v_old_tier_id,
      'new_tier_id', v_new_tier_id,
      'old_tier_name', v_old_tier_name,
      'new_tier_name', v_new_tier_name,
      'total_points', v_total_points
    )
  );

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
      end if;
    end loop;
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.transactions') is not null then
    execute 'drop trigger if exists update_user_streak on public.transactions';
    execute 'create trigger update_user_streak after insert on public.transactions for each row execute function public.trg_update_user_streak()';

    execute 'drop trigger if exists check_challenge_completion on public.transactions';
    execute 'create trigger check_challenge_completion after insert on public.transactions for each row execute function public.trg_check_challenge_completion()';
  end if;

  if to_regclass('public.users') is not null then
    execute 'drop trigger if exists check_tier_upgrade on public.users';
    execute 'create trigger check_tier_upgrade after update of total_points on public.users for each row execute function public.trg_check_tier_upgrade()';
  end if;
end $$;