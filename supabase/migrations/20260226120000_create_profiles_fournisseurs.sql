create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('client', 'fournisseur')),
  nom text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fournisseurs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nom_commerce text not null,
  adresse text not null default 'N/A',
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_fournisseurs_user_id on public.fournisseurs (user_id);

alter table public.profiles enable row level security;
alter table public.fournisseurs enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Providers can read own fournisseur" on public.fournisseurs;
create policy "Providers can read own fournisseur"
  on public.fournisseurs
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Providers can update own fournisseur" on public.fournisseurs;
create policy "Providers can update own fournisseur"
  on public.fournisseurs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Seed profiles from existing auth users when possible.
insert into public.profiles (id, email, role, nom)
select
  u.id,
  coalesce(u.email, concat(u.id::text, '@local.test')),
  case
    when coalesce(u.raw_user_meta_data->>'role', 'client') = 'fournisseur' then 'fournisseur'
    else 'client'
  end,
  coalesce(u.raw_user_meta_data->>'nom', split_part(coalesce(u.email, 'User'), '@', 1), 'User')
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  role = excluded.role,
  nom = excluded.nom;

-- Seed fournisseurs from users with fournisseur role.
insert into public.fournisseurs (user_id, nom_commerce, adresse)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'nom', split_part(coalesce(u.email, 'Commerce'), '@', 1), 'Commerce'),
  'N/A'
from auth.users u
where coalesce(u.raw_user_meta_data->>'role', 'client') = 'fournisseur'
on conflict (user_id) do nothing;
