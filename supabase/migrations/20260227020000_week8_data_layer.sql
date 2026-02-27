create extension if not exists pgcrypto;

-- Allow admin role in profiles.
do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      drop constraint if exists profiles_role_check;

    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('client', 'fournisseur', 'admin'));
  end if;
end $$;

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
  );
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
as $$
  select auth.role() = 'service_role' or public.is_admin_user(auth.uid());
$$;

-- Step 14: premium tier fields.
do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    alter table public.fournisseurs
      add column if not exists tier text not null default 'free';

    alter table public.fournisseurs
      add column if not exists tier_expires_at timestamptz;

    alter table public.fournisseurs
      add column if not exists max_clients integer not null default 100;

    alter table public.fournisseurs
      drop constraint if exists fournisseurs_tier_check;

    alter table public.fournisseurs
      add constraint fournisseurs_tier_check
      check (tier in ('free', 'starter', 'premium', 'enterprise'));
  end if;
end $$;

-- Step 1: data-layer tables.
create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid not null,
  event_type text not null,
  properties jsonb not null default '{}'::jsonb,
  page text,
  device_type text,
  app_version text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_events_user_id on public.user_events(user_id);
create index if not exists idx_user_events_type on public.user_events(event_type);
create index if not exists idx_user_events_created on public.user_events(created_at);

create table if not exists public.user_segments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  segment_type text not null,
  segment_data jsonb not null default '{}'::jsonb,
  score numeric,
  computed_at timestamptz not null default now(),
  unique(client_id, segment_type)
);

create index if not exists idx_user_segments_client on public.user_segments(client_id);
create index if not exists idx_user_segments_type on public.user_segments(segment_type);

create table if not exists public.provider_benchmarks (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  category text not null,
  city text,
  country_code varchar(2),
  metric_key text not null,
  metric_value numeric,
  industry_avg numeric,
  industry_p25 numeric,
  industry_p75 numeric,
  period text not null,
  computed_at timestamptz not null default now(),
  unique(fournisseur_id, metric_key, period)
);

create index if not exists idx_provider_benchmarks_provider on public.provider_benchmarks(fournisseur_id);
create index if not exists idx_provider_benchmarks_metric on public.provider_benchmarks(metric_key, period);

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  policy_version text not null,
  ip_address inet,
  user_agent text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(user_id, consent_type, policy_version)
);

create index if not exists idx_user_consents_user on public.user_consents(user_id, consent_type, granted_at desc);

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  deletion_log jsonb not null default '{}'::jsonb
);

create index if not exists idx_deletion_requests_user on public.deletion_requests(user_id, requested_at desc);

create table if not exists public.export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  download_url text,
  expires_at timestamptz,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_export_requests_user on public.export_requests(user_id, requested_at desc);

create table if not exists public.platform_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text unique not null,
  metric_value numeric,
  metric_data jsonb not null default '{}'::jsonb,
  period text,
  computed_at timestamptz not null default now()
);

create table if not exists public.jobs_log (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  duration_ms integer,
  records_processed integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_log_name_created on public.jobs_log(job_name, created_at desc);

-- Checks.
alter table public.user_events
  drop constraint if exists user_events_device_type_check;
alter table public.user_events
  add constraint user_events_device_type_check
  check (device_type is null or device_type in ('mobile', 'tablet', 'desktop'));

alter table public.user_segments
  drop constraint if exists user_segments_type_check;
alter table public.user_segments
  add constraint user_segments_type_check
  check (
    segment_type in (
      'champion', 'loyal', 'potential', 'at_risk', 'lost', 'new',
      'high_value', 'medium', 'budget', 'bargain_hunter', 'occasional'
    )
  );

alter table public.user_consents
  drop constraint if exists user_consents_type_check;
alter table public.user_consents
  add constraint user_consents_type_check
  check (consent_type in ('essential', 'analytics', 'marketing', 'third_party'));

alter table public.deletion_requests
  drop constraint if exists deletion_requests_status_check;
alter table public.deletion_requests
  add constraint deletion_requests_status_check
  check (status in ('pending', 'processing', 'completed', 'failed'));

alter table public.export_requests
  drop constraint if exists export_requests_status_check;
alter table public.export_requests
  add constraint export_requests_status_check
  check (status in ('pending', 'processing', 'completed', 'failed'));

-- RLS.
alter table public.user_events enable row level security;
alter table public.user_segments enable row level security;
alter table public.user_consents enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.export_requests enable row level security;
alter table public.provider_benchmarks enable row level security;
alter table public.platform_metrics enable row level security;
alter table public.jobs_log enable row level security;

drop policy if exists "Users insert own events" on public.user_events;
create policy "Users insert own events"
  on public.user_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users read own segments" on public.user_segments;
create policy "Users read own segments"
  on public.user_segments
  for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists "Users read own consents" on public.user_consents;
drop policy if exists "Users insert own consents" on public.user_consents;
drop policy if exists "Users update own consents" on public.user_consents;

create policy "Users read own consents"
  on public.user_consents
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert own consents"
  on public.user_consents
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own consents"
  on public.user_consents
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users insert own deletion requests" on public.deletion_requests;
drop policy if exists "Users read own deletion requests" on public.deletion_requests;

create policy "Users insert own deletion requests"
  on public.deletion_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users read own deletion requests"
  on public.deletion_requests
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users insert own export requests" on public.export_requests;
drop policy if exists "Users read own export requests" on public.export_requests;
drop policy if exists "Users update own export requests" on public.export_requests;

create policy "Users insert own export requests"
  on public.export_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users read own export requests"
  on public.export_requests
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users update own export requests"
  on public.export_requests
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Providers read own benchmarks" on public.provider_benchmarks;
create policy "Providers read own benchmarks"
  on public.provider_benchmarks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = provider_benchmarks.fournisseur_id
        and f.user_id = auth.uid()
    )
  );

drop policy if exists "Admins read platform metrics" on public.platform_metrics;
create policy "Admins read platform metrics"
  on public.platform_metrics
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Admins read jobs logs" on public.jobs_log;
create policy "Admins read jobs logs"
  on public.jobs_log
  for select
  to authenticated
  using (public.is_current_user_admin());

-- Segmentation SQL functions (Step 6).
create or replace function public.compute_rfm_score(p_client_id uuid)
returns table (
  recency_days integer,
  frequency_count integer,
  monetary_total numeric,
  r_score integer,
  f_score integer,
  m_score integer,
  rfm_score integer,
  rfm_segment text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_visit timestamptz;
  v_frequency integer;
  v_monetary numeric;
  v_recency integer;
  v_r integer;
  v_f integer;
  v_m integer;
  v_total integer;
  v_segment text;
begin
  select
    max(t.created_at),
    count(*)::integer,
    coalesce(sum(t.montant), 0)
  into
    v_last_visit,
    v_frequency,
    v_monetary
  from public.transactions t
  where t.client_id = p_client_id
    and t.status = 'validated'
    and t.created_at >= now() - interval '90 days';

  if v_last_visit is null then
    v_recency := 999;
  else
    v_recency := greatest(0, floor(extract(epoch from (now() - v_last_visit)) / 86400)::integer);
  end if;

  v_r := case
    when v_recency <= 7 then 5
    when v_recency <= 30 then 4
    when v_recency <= 60 then 3
    when v_recency <= 120 then 2
    else 1
  end;

  v_f := case
    when coalesce(v_frequency, 0) >= 12 then 5
    when coalesce(v_frequency, 0) >= 8 then 4
    when coalesce(v_frequency, 0) >= 4 then 3
    when coalesce(v_frequency, 0) >= 2 then 2
    when coalesce(v_frequency, 0) = 1 then 1
    else 0
  end;

  v_m := case
    when coalesce(v_monetary, 0) >= 1000 then 5
    when coalesce(v_monetary, 0) >= 500 then 4
    when coalesce(v_monetary, 0) >= 250 then 3
    when coalesce(v_monetary, 0) >= 100 then 2
    when coalesce(v_monetary, 0) > 0 then 1
    else 0
  end;

  v_total := coalesce(v_r, 0) + coalesce(v_f, 0) + coalesce(v_m, 0);

  v_segment := case
    when v_recency > 120 then 'lost'
    when v_recency > 60 then 'at_risk'
    when coalesce(v_frequency, 0) = 1 then 'new'
    when v_total >= 9 then 'champion'
    when v_total >= 7 then 'loyal'
    when v_total >= 5 then 'potential'
    else 'occasional'
  end;

  return query
  select
    v_recency,
    coalesce(v_frequency, 0),
    coalesce(v_monetary, 0),
    v_r,
    v_f,
    v_m,
    v_total,
    v_segment;
end;
$$;

create or replace function public.classify_spending_level(p_client_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  with client_avg as (
    select coalesce(avg(t.montant), 0) as avg_value
    from public.transactions t
    where t.client_id = p_client_id
      and t.status = 'validated'
      and t.created_at >= now() - interval '90 days'
  ),
  platform_avg as (
    select coalesce(avg(t.montant), 0) as avg_value
    from public.transactions t
    where t.status = 'validated'
      and t.created_at >= now() - interval '90 days'
  )
  select case
    when ca.avg_value >= pa.avg_value * 1.25 then 'high_value'
    when ca.avg_value <= pa.avg_value * 0.75 then 'budget'
    else 'medium'
  end
  from client_avg ca
  cross join platform_avg pa;
$$;

create or replace function public.compute_all_segments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_rfm record;
  v_spending text;
  v_processed integer := 0;
begin
  for v_row in
    select p.id
    from public.profiles p
    where p.role = 'client'
  loop
    select *
    into v_rfm
    from public.compute_rfm_score(v_row.id)
    limit 1;

    v_spending := public.classify_spending_level(v_row.id);

    insert into public.user_segments (
      client_id,
      segment_type,
      segment_data,
      score,
      computed_at
    ) values (
      v_row.id,
      coalesce(v_rfm.rfm_segment, 'occasional'),
      jsonb_build_object(
        'recency_days', coalesce(v_rfm.recency_days, 999),
        'frequency_count', coalesce(v_rfm.frequency_count, 0),
        'monetary_total', coalesce(v_rfm.monetary_total, 0),
        'r_score', coalesce(v_rfm.r_score, 0),
        'f_score', coalesce(v_rfm.f_score, 0),
        'm_score', coalesce(v_rfm.m_score, 0),
        'rfm_score', coalesce(v_rfm.rfm_score, 0)
      ),
      coalesce(v_rfm.rfm_score, 0),
      now()
    )
    on conflict (client_id, segment_type)
    do update set
      segment_data = excluded.segment_data,
      score = excluded.score,
      computed_at = excluded.computed_at;

    insert into public.user_segments (
      client_id,
      segment_type,
      segment_data,
      score,
      computed_at
    ) values (
      v_row.id,
      v_spending,
      jsonb_build_object('source', 'classify_spending_level'),
      null,
      now()
    )
    on conflict (client_id, segment_type)
    do update set
      segment_data = excluded.segment_data,
      computed_at = excluded.computed_at;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

create or replace function public.get_segment_distribution()
returns table (
  segment_type text,
  total bigint
)
language sql
security definer
set search_path = public
as $$
  select us.segment_type, count(*) as total
  from public.user_segments us
  where us.computed_at >= now() - interval '30 days'
  group by us.segment_type
  order by total desc;
$$;

create or replace function public.detect_churn_risk(p_fournisseur_id uuid)
returns table (
  client_id uuid,
  last_visit timestamptz,
  visit_count bigint
)
language sql
security definer
set search_path = public
as $$
  with per_client as (
    select
      t.client_id,
      max(t.created_at) as last_visit,
      count(*) as visit_count
    from public.transactions t
    where t.fournisseur_id = p_fournisseur_id
      and t.status = 'validated'
      and t.client_id is not null
    group by t.client_id
  )
  select
    pc.client_id,
    pc.last_visit,
    pc.visit_count
  from per_client pc
  where pc.visit_count > 3
    and pc.last_visit < now() - interval '60 days'
  order by pc.last_visit asc;
$$;

-- Step 15 helpers.
create or replace function public.recompute_provider_benchmarks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_processed integer := 0;
begin
  insert into public.provider_benchmarks (
    fournisseur_id,
    category,
    city,
    country_code,
    metric_key,
    metric_value,
    industry_avg,
    industry_p25,
    industry_p75,
    period,
    computed_at
  )
  select
    f.id,
    'general' as category,
    null::text as city,
    null::varchar(2) as country_code,
    metric.metric_key,
    metric.metric_value,
    metric.industry_avg,
    metric.industry_p25,
    metric.industry_p75,
    to_char(now(), 'IYYY-"W"IW') as period,
    now()
  from public.fournisseurs f
  cross join lateral (
    with tx as (
      select t.montant
      from public.transactions t
      where t.fournisseur_id = f.id
        and t.status = 'validated'
        and t.created_at >= now() - interval '30 days'
    )
    select *
    from (
      select
        'avg_transaction'::text as metric_key,
        coalesce(avg(tx.montant), 0)::numeric as metric_value,
        coalesce(avg(tx.montant), 0)::numeric as industry_avg,
        coalesce(percentile_disc(0.25) within group (order by tx.montant), 0)::numeric as industry_p25,
        coalesce(percentile_disc(0.75) within group (order by tx.montant), 0)::numeric as industry_p75
      from tx
    ) metrics
  ) metric
  on conflict (fournisseur_id, metric_key, period)
  do update set
    metric_value = excluded.metric_value,
    industry_avg = excluded.industry_avg,
    industry_p25 = excluded.industry_p25,
    industry_p75 = excluded.industry_p75,
    computed_at = excluded.computed_at;

  get diagnostics v_processed = row_count;
  return v_processed;
end;
$$;

create or replace function public.expire_old_qr_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.qr_tokens
  set status = 'expired'
  where expires_at < now()
    and status = 'active';

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
exception
  when undefined_table then
    return 0;
end;
$$;

drop function if exists public.cancel_expired_pending_transactions();

create or replace function public.cancel_expired_pending_transactions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.pending_transactions
  set status = 'cancelled'
  where expires_at < now()
    and status = 'pending';

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
exception
  when undefined_table then
    return 0;
end;
$$;

create or replace function public.compute_platform_metrics_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_providers bigint := 0;
  v_active_clients bigint := 0;
  v_dau bigint := 0;
  v_period text := to_char(now(), 'YYYY-MM-DD');
begin
  select count(distinct t.fournisseur_id)
  into v_active_providers
  from public.transactions t
  where t.status = 'validated'
    and t.created_at >= now() - interval '30 days';

  select count(distinct t.client_id)
  into v_active_clients
  from public.transactions t
  where t.status = 'validated'
    and t.client_id is not null
    and t.created_at >= now() - interval '30 days';

  select count(distinct t.client_id)
  into v_dau
  from public.transactions t
  where t.status = 'validated'
    and t.client_id is not null
    and t.created_at >= date_trunc('day', now() - interval '1 day')
    and t.created_at < date_trunc('day', now());

  insert into public.platform_metrics (metric_key, metric_value, metric_data, period, computed_at)
  values ('platform.active_providers_30d', v_active_providers, '{}'::jsonb, v_period, now())
  on conflict (metric_key)
  do update set metric_value = excluded.metric_value, period = excluded.period, computed_at = excluded.computed_at;

  insert into public.platform_metrics (metric_key, metric_value, metric_data, period, computed_at)
  values ('platform.active_clients_30d', v_active_clients, '{}'::jsonb, v_period, now())
  on conflict (metric_key)
  do update set metric_value = excluded.metric_value, period = excluded.period, computed_at = excluded.computed_at;

  insert into public.platform_metrics (metric_key, metric_value, metric_data, period, computed_at)
  values ('platform.dau_yesterday', v_dau, '{}'::jsonb, v_period, now())
  on conflict (metric_key)
  do update set metric_value = excluded.metric_value, period = excluded.period, computed_at = excluded.computed_at;

  return jsonb_build_object(
    'active_providers_30d', v_active_providers,
    'active_clients_30d', v_active_clients,
    'dau_yesterday', v_dau,
    'period', v_period
  );
end;
$$;

create or replace function public.create_at_risk_provider_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if to_regclass('public.notifications') is null then
    return 0;
  end if;

  with current_month as (
    select t.fournisseur_id, count(*)::numeric as tx_count
    from public.transactions t
    where t.status = 'validated'
      and t.created_at >= date_trunc('month', now())
    group by t.fournisseur_id
  ),
  previous_month as (
    select t.fournisseur_id, count(*)::numeric as tx_count
    from public.transactions t
    where t.status = 'validated'
      and t.created_at >= date_trunc('month', now()) - interval '1 month'
      and t.created_at < date_trunc('month', now())
    group by t.fournisseur_id
  ),
  at_risk as (
    select
      p.fournisseur_id,
      p.tx_count as prev_count,
      coalesce(c.tx_count, 0) as curr_count
    from previous_month p
    left join current_month c on c.fournisseur_id = p.fournisseur_id
    where p.tx_count > 0
      and coalesce(c.tx_count, 0) <= p.tx_count * 0.5
  )
  insert into public.notifications (user_id, title, body, type, created_at)
  select
    pr.id,
    'Alerte activité fournisseur',
    format('Activité en baisse >50%% pour fournisseur %s', ar.fournisseur_id),
    'admin_alert',
    now()
  from at_risk ar
  join public.profiles pr on pr.role = 'admin';

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
exception
  when undefined_column then
    return 0;
end;
$$;

revoke all on function public.compute_rfm_score(uuid) from public;
revoke all on function public.compute_all_segments() from public;
revoke all on function public.get_segment_distribution() from public;
revoke all on function public.classify_spending_level(uuid) from public;
revoke all on function public.detect_churn_risk(uuid) from public;
revoke all on function public.recompute_provider_benchmarks() from public;
revoke all on function public.expire_old_qr_tokens() from public;
revoke all on function public.cancel_expired_pending_transactions() from public;
revoke all on function public.compute_platform_metrics_snapshot() from public;
revoke all on function public.create_at_risk_provider_alerts() from public;

grant execute on function public.compute_rfm_score(uuid) to authenticated, service_role;
grant execute on function public.compute_all_segments() to service_role;
grant execute on function public.get_segment_distribution() to authenticated, service_role;
grant execute on function public.classify_spending_level(uuid) to authenticated, service_role;
grant execute on function public.detect_churn_risk(uuid) to authenticated, service_role;
grant execute on function public.recompute_provider_benchmarks() to service_role;
grant execute on function public.expire_old_qr_tokens() to service_role;
grant execute on function public.cancel_expired_pending_transactions() to service_role;
grant execute on function public.compute_platform_metrics_snapshot() to service_role;
grant execute on function public.create_at_risk_provider_alerts() to service_role;
