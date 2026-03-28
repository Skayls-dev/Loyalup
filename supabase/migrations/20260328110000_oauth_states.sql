-- oauth_states: CSRF protection table for OAuth flows (SumUp, etc.)
-- Rows are short-lived (TTL ~10 min) and deleted after use.

create extension if not exists "pgcrypto";

create table if not exists public.oauth_states (
  id          uuid        primary key default gen_random_uuid(),
  state       text        not null unique,
  provider    text        not null check (provider in ('sumup')),
  fournisseur_id uuid     not null references public.fournisseurs(id) on delete cascade,
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  created_at  timestamptz not null default now()
);

create index if not exists idx_oauth_states_state
  on public.oauth_states (state);

create index if not exists idx_oauth_states_expires
  on public.oauth_states (expires_at);

-- RLS --
alter table public.oauth_states enable row level security;

drop policy if exists "service_role_full" on public.oauth_states;
create policy "service_role_full"
  on public.oauth_states
  to service_role
  using (true)
  with check (true);
