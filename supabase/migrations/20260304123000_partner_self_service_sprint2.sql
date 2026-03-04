create table if not exists public.partner_provider_links (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'developer', 'ops')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(partner_id, fournisseur_id),
  unique(fournisseur_id)
);

create index if not exists idx_partner_provider_links_partner on public.partner_provider_links(partner_id);
create index if not exists idx_partner_provider_links_fournisseur on public.partner_provider_links(fournisseur_id);

create table if not exists public.partner_access_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  requested_environment text not null default 'production' check (requested_environment in ('production')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_access_requests_partner on public.partner_access_requests(partner_id, created_at desc);
create index if not exists idx_partner_access_requests_status on public.partner_access_requests(status, created_at desc);

create unique index if not exists uq_partner_access_pending
  on public.partner_access_requests(partner_id)
  where status = 'pending';
