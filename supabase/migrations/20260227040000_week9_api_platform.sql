create extension if not exists pgcrypto;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  name text not null,
  key_hash text unique not null,
  key_prefix varchar(16) not null,
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  scopes text[] not null default array['read']::text[],
  grace_until timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  endpoint text not null,
  method text not null,
  status_code integer,
  response_time_ms integer,
  request_size_bytes integer,
  response_size_bytes integer,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_usage_key_id on public.api_usage(api_key_id);
create index if not exists idx_api_usage_created on public.api_usage(created_at desc);

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null,
  is_active boolean not null default true,
  failure_count integer not null default 0,
  last_triggered_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  response_status integer,
  response_body text,
  duration_ms integer,
  attempt_number integer not null default 1,
  success boolean not null default false,
  delivered_at timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_webhook on public.webhook_deliveries(webhook_id, delivered_at desc);

create table if not exists public.white_label_configs (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  brand_name text not null,
  logo_url text,
  favicon_url text,
  primary_color varchar(7),
  secondary_color varchar(7),
  accent_color varchar(7),
  font_family text not null default 'DM Sans',
  custom_domain text unique,
  domain_verified boolean not null default false,
  domain_verified_at timestamptz,
  verification_token text,
  hide_loyalup_branding boolean not null default false,
  custom_terms_url text,
  custom_privacy_url text,
  from_email text,
  from_name text,
  email_header_color varchar(7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fournisseur_id)
);

create table if not exists public.rate_limit_rules (
  id uuid primary key default gen_random_uuid(),
  tier text not null unique,
  requests_per_minute integer not null,
  requests_per_day integer not null,
  max_webhooks integer not null,
  max_api_keys integer not null,
  sandbox_enabled boolean not null default true
);

create table if not exists public.api_rate_windows (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  window_type text not null check (window_type in ('minute', 'day')),
  window_key text not null,
  usage_count integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(api_key_id, window_type, window_key)
);

create index if not exists idx_api_rate_windows_expiry on public.api_rate_windows(expires_at);

create table if not exists public.provider_action_limits (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null references public.profiles(id) on delete cascade,
  action_key text not null,
  hour_bucket text not null,
  usage_count integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(provider_user_id, action_key, hour_bucket)
);

create index if not exists idx_provider_action_limits_expiry on public.provider_action_limits(expires_at);

insert into public.rate_limit_rules (id, tier, requests_per_minute, requests_per_day, max_webhooks, max_api_keys, sandbox_enabled)
values
  (gen_random_uuid(), 'free', 10, 100, 0, 1, false),
  (gen_random_uuid(), 'starter', 60, 1000, 2, 3, true),
  (gen_random_uuid(), 'premium', 300, 10000, 10, 10, true),
  (gen_random_uuid(), 'enterprise', 3000, 500000, 50, 50, true)
on conflict (tier) do update set
  requests_per_minute = excluded.requests_per_minute,
  requests_per_day = excluded.requests_per_day,
  max_webhooks = excluded.max_webhooks,
  max_api_keys = excluded.max_api_keys,
  sandbox_enabled = excluded.sandbox_enabled;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_white_label_updated_at on public.white_label_configs;
create trigger trg_white_label_updated_at
before update on public.white_label_configs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_api_rate_windows_updated_at on public.api_rate_windows;
create trigger trg_api_rate_windows_updated_at
before update on public.api_rate_windows
for each row
execute function public.set_updated_at();

alter table public.api_keys enable row level security;
alter table public.api_usage enable row level security;
alter table public.webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.white_label_configs enable row level security;
alter table public.rate_limit_rules enable row level security;
alter table public.api_rate_windows enable row level security;
alter table public.provider_action_limits enable row level security;

-- api_keys policies

drop policy if exists "Providers manage own api keys" on public.api_keys;
create policy "Providers manage own api keys"
  on public.api_keys
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = api_keys.fournisseur_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = api_keys.fournisseur_id
        and f.user_id = auth.uid()
    )
  );

-- api_usage policies

drop policy if exists "Providers read own api usage" on public.api_usage;
create policy "Providers read own api usage"
  on public.api_usage
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.api_keys k
      join public.fournisseurs f on f.id = k.fournisseur_id
      where k.id = api_usage.api_key_id
        and f.user_id = auth.uid()
    )
  );

-- webhooks policies

drop policy if exists "Providers manage own webhooks" on public.webhooks;
create policy "Providers manage own webhooks"
  on public.webhooks
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = webhooks.fournisseur_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = webhooks.fournisseur_id
        and f.user_id = auth.uid()
    )
  );

-- webhook deliveries policies

drop policy if exists "Providers read own webhook deliveries" on public.webhook_deliveries;
create policy "Providers read own webhook deliveries"
  on public.webhook_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.webhooks w
      join public.fournisseurs f on f.id = w.fournisseur_id
      where w.id = webhook_deliveries.webhook_id
        and f.user_id = auth.uid()
    )
  );

-- white label policies

drop policy if exists "Providers manage own white label" on public.white_label_configs;
create policy "Providers manage own white label"
  on public.white_label_configs
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = white_label_configs.fournisseur_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = white_label_configs.fournisseur_id
        and f.user_id = auth.uid()
    )
  );

-- rate limit rules public read

drop policy if exists "Public read rate limit rules" on public.rate_limit_rules;
create policy "Public read rate limit rules"
  on public.rate_limit_rules
  for select
  to public
  using (true);

-- internal rate window read policy for providers

drop policy if exists "Providers read own api rate windows" on public.api_rate_windows;
create policy "Providers read own api rate windows"
  on public.api_rate_windows
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.api_keys k
      join public.fournisseurs f on f.id = k.fournisseur_id
      where k.id = api_rate_windows.api_key_id
        and f.user_id = auth.uid()
    )
  );

revoke all on public.api_keys from anon, authenticated;
revoke all on public.webhooks from anon, authenticated;
revoke all on public.white_label_configs from anon, authenticated;
revoke all on public.api_rate_windows from anon, authenticated;

grant select, insert, update, delete on public.api_keys to authenticated;
grant select, insert, update, delete on public.webhooks to authenticated;
grant select, insert, update, delete on public.white_label_configs to authenticated;
grant select on public.api_usage to authenticated;
grant select on public.webhook_deliveries to authenticated;
grant select on public.rate_limit_rules to anon, authenticated;
grant select on public.api_rate_windows to authenticated;

drop policy if exists "Providers read own action limits" on public.provider_action_limits;
create policy "Providers read own action limits"
  on public.provider_action_limits
  for select
  to authenticated
  using (provider_user_id = auth.uid());

revoke all on public.provider_action_limits from anon, authenticated;
grant select on public.provider_action_limits to authenticated;
