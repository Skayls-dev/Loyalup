create extension if not exists pgcrypto;

create table if not exists public.merchant_ratings (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique,
  client_id uuid not null,
  fournisseur_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_merchant_ratings_fournisseur_created_at
  on public.merchant_ratings (fournisseur_id, created_at desc);
create index if not exists idx_merchant_ratings_client_created_at
  on public.merchant_ratings (client_id, created_at desc);

do $$
begin
  if to_regclass('public.transactions') is not null then
    alter table if exists public.merchant_ratings
      drop constraint if exists merchant_ratings_transaction_fk;

    alter table if exists public.merchant_ratings
      add constraint merchant_ratings_transaction_fk
      foreign key (transaction_id) references public.transactions(id) on delete cascade;
  end if;

  if to_regclass('public.profiles') is not null then
    alter table if exists public.merchant_ratings
      drop constraint if exists merchant_ratings_client_fk;

    alter table if exists public.merchant_ratings
      add constraint merchant_ratings_client_fk
      foreign key (client_id) references public.profiles(id) on delete cascade;
  end if;

  if to_regclass('public.fournisseurs') is not null then
    alter table if exists public.merchant_ratings
      drop constraint if exists merchant_ratings_fournisseur_fk;

    alter table if exists public.merchant_ratings
      add constraint merchant_ratings_fournisseur_fk
      foreign key (fournisseur_id) references public.fournisseurs(id) on delete cascade;
  end if;
end $$;

create or replace function public.sync_merchant_rating_refs()
returns trigger
language plpgsql
as $$
declare
  tx record;
begin
  select
    t.client_id,
    t.fournisseur_id,
    t.status,
    t.points_credited,
    t.transaction_type
  into tx
  from public.transactions t
  where t.id = new.transaction_id;

  if tx is null then
    raise exception 'RATING_TRANSACTION_NOT_FOUND';
  end if;

  if tx.status <> 'validated'
    or coalesce(tx.points_credited, 0) <= 0
    or coalesce(tx.transaction_type, 'purchase') = 'reward_redemption'
  then
    raise exception 'RATING_TRANSACTION_NOT_ELIGIBLE';
  end if;

  new.client_id = tx.client_id;
  new.fournisseur_id = tx.fournisseur_id;

  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_merchant_rating_refs on public.merchant_ratings;
create trigger trg_sync_merchant_rating_refs
before insert or update on public.merchant_ratings
for each row
execute function public.sync_merchant_rating_refs();

alter table public.merchant_ratings enable row level security;

drop policy if exists "Clients can read own merchant ratings" on public.merchant_ratings;
create policy "Clients can read own merchant ratings"
  on public.merchant_ratings
  for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists "Clients can insert own merchant ratings" on public.merchant_ratings;
create policy "Clients can insert own merchant ratings"
  on public.merchant_ratings
  for insert
  to authenticated
  with check (client_id = auth.uid());

drop policy if exists "Clients can update own merchant ratings" on public.merchant_ratings;
create policy "Clients can update own merchant ratings"
  on public.merchant_ratings
  for update
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "Fournisseurs can read ratings for their store" on public.merchant_ratings;
create policy "Fournisseurs can read ratings for their store"
  on public.merchant_ratings
  for select
  to authenticated
  using (
    fournisseur_id in (
      select id
      from public.fournisseurs
      where user_id = auth.uid()
    )
  );