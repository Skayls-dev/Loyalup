create extension if not exists pgcrypto;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'sandbox_active', 'production_active', 'suspended')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_api_credentials (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  key_prefix varchar(16) not null,
  key_hash text not null unique,
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  scopes text[] not null default array['transfers:write']::text[],
  is_active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique(partner_id, key_prefix)
);

create table if not exists public.partner_user_links (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  external_user_id text not null,
  loyalup_user_id uuid not null references public.profiles(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  linked_at timestamptz not null default now(),
  unique(partner_id, external_user_id)
);

create table if not exists public.partner_points_wallets (
  id uuid primary key default gen_random_uuid(),
  loyalup_user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_point_transfers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  credential_id uuid not null references public.partner_api_credentials(id) on delete restrict,
  loyalup_user_id uuid not null references public.profiles(id) on delete restrict,
  external_user_id text not null,
  transaction_ref text not null,
  idempotency_key text,
  direction text not null check (direction in ('credit', 'debit')),
  points_delta integer not null check (points_delta <> 0),
  status text not null default 'processing' check (status in ('processing', 'accepted', 'rejected')),
  error_code text,
  resulting_balance bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(partner_id, transaction_ref),
  unique(partner_id, idempotency_key)
);

create index if not exists idx_partner_credentials_partner on public.partner_api_credentials(partner_id, is_active);
create index if not exists idx_partner_links_partner_external on public.partner_user_links(partner_id, external_user_id);
create index if not exists idx_partner_transfers_partner_created on public.partner_point_transfers(partner_id, created_at desc);
create index if not exists idx_partner_transfers_user_created on public.partner_point_transfers(loyalup_user_id, created_at desc);

insert into public.partners (code, name, status)
values ('KUVAAGO', 'KUVAAGO', 'sandbox_active')
on conflict (code) do update set
  name = excluded.name;

drop trigger if exists trg_partners_updated_at on public.partners;
create trigger trg_partners_updated_at
before update on public.partners
for each row
execute function public.set_updated_at();