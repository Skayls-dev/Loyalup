create extension if not exists pgcrypto;

create table if not exists public.provider_integrations (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  provider text not null check (provider in ('sumup')),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),

  -- OAuth tokens (chiffres via pgsodium ou stockes dans vault)
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,

  -- Metadonnees SumUp
  sumup_merchant_code text,
  sumup_merchant_name text,
  scopes text[] default array['transactions.history', 'user.profile_readonly']::text[],

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(fournisseur_id, provider)
);

create index if not exists idx_provider_integrations_fournisseur
  on public.provider_integrations(fournisseur_id);

create index if not exists idx_provider_integrations_expires
  on public.provider_integrations(expires_at)
  where status = 'active';

alter table public.provider_integrations enable row level security;

drop policy if exists "marchand_own_integration" on public.provider_integrations;
create policy "marchand_own_integration"
  on public.provider_integrations
  for all
  to authenticated
  using (
    fournisseur_id in (
      select f.id
      from public.fournisseurs f
      where f.user_id = auth.uid()
    )
  )
  with check (
    fournisseur_id in (
      select f.id
      from public.fournisseurs f
      where f.user_id = auth.uid()
    )
  );

drop policy if exists "service_role_full" on public.provider_integrations;
create policy "service_role_full"
  on public.provider_integrations
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists provider_integrations_updated_at on public.provider_integrations;
create trigger provider_integrations_updated_at
before update on public.provider_integrations
for each row execute function public.update_updated_at();
