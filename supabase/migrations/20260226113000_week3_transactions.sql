create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null,
  nom text not null,
  emoji text not null,
  prix_defaut numeric null,
  points_defaut integer null,
  points_per_euro numeric not null default 10,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  pending_transaction_id uuid not null,
  client_id uuid not null,
  fournisseur_id uuid not null,
  service_id uuid null,
  montant numeric not null,
  points_credited integer not null,
  status text not null check (status in ('validated', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.client_points (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  fournisseur_id uuid not null,
  solde integer not null default 0,
  total_visites integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, fournisseur_id)
);

create index if not exists idx_services_fournisseur_id on public.services (fournisseur_id);
create index if not exists idx_services_actif on public.services (actif);
create index if not exists idx_transactions_fournisseur_id_created_at
  on public.transactions (fournisseur_id, created_at desc);
create index if not exists idx_transactions_client_id_created_at
  on public.transactions (client_id, created_at desc);
create index if not exists idx_client_points_client_fournisseur
  on public.client_points (client_id, fournisseur_id);

-- FKs are added only if referenced tables exist in current environment.
do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    alter table if exists public.services
      drop constraint if exists services_fournisseur_fk;

    alter table if exists public.services
      add constraint services_fournisseur_fk
      foreign key (fournisseur_id) references public.fournisseurs(id) on delete cascade;
  end if;

  if to_regclass('public.pending_transactions') is not null then
    alter table if exists public.transactions
      drop constraint if exists transactions_pending_transaction_fk;

    alter table if exists public.transactions
      add constraint transactions_pending_transaction_fk
      foreign key (pending_transaction_id) references public.pending_transactions(id) on delete cascade;
  end if;

  if to_regclass('public.profiles') is not null then
    alter table if exists public.transactions
      drop constraint if exists transactions_client_fk;

    alter table if exists public.transactions
      add constraint transactions_client_fk
      foreign key (client_id) references public.profiles(id) on delete cascade;

    alter table if exists public.client_points
      drop constraint if exists client_points_client_fk;

    alter table if exists public.client_points
      add constraint client_points_client_fk
      foreign key (client_id) references public.profiles(id) on delete cascade;
  end if;

  if to_regclass('public.fournisseurs') is not null then
    alter table if exists public.transactions
      drop constraint if exists transactions_fournisseur_fk;

    alter table if exists public.transactions
      add constraint transactions_fournisseur_fk
      foreign key (fournisseur_id) references public.fournisseurs(id) on delete cascade;

    alter table if exists public.client_points
      drop constraint if exists client_points_fournisseur_fk;

    alter table if exists public.client_points
      add constraint client_points_fournisseur_fk
      foreign key (fournisseur_id) references public.fournisseurs(id) on delete cascade;
  end if;

  if to_regclass('public.services') is not null then
    alter table if exists public.transactions
      drop constraint if exists transactions_service_fk;

    alter table if exists public.transactions
      add constraint transactions_service_fk
      foreign key (service_id) references public.services(id) on delete set null;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_client_points_set_updated_at on public.client_points;
create trigger trg_client_points_set_updated_at
before update on public.client_points
for each row
execute function public.set_updated_at();

alter table public.services enable row level security;
alter table public.transactions enable row level security;
alter table public.client_points enable row level security;

-- services: providers can CRUD their own services
-- When fournisseurs table is unavailable, these policies are skipped.
drop policy if exists "Providers can read own services" on public.services;
drop policy if exists "Providers can insert own services" on public.services;
drop policy if exists "Providers can update own services" on public.services;
drop policy if exists "Providers can delete own services" on public.services;

do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    create policy "Providers can read own services"
      on public.services
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = services.fournisseur_id
            and f.user_id = auth.uid()
        )
      );

    create policy "Providers can insert own services"
      on public.services
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = services.fournisseur_id
            and f.user_id = auth.uid()
        )
      );

    create policy "Providers can update own services"
      on public.services
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = services.fournisseur_id
            and f.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = services.fournisseur_id
            and f.user_id = auth.uid()
        )
      );

    create policy "Providers can delete own services"
      on public.services
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = services.fournisseur_id
            and f.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- transactions: providers can read their own transactions; clients can read their own transactions
-- No INSERT/UPDATE policy is created for authenticated users: only service role can write.
drop policy if exists "Providers can read own transactions" on public.transactions;
drop policy if exists "Clients can read own transactions" on public.transactions;

do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    create policy "Providers can read own transactions"
      on public.transactions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = transactions.fournisseur_id
            and f.user_id = auth.uid()
        )
      );
  end if;

  create policy "Clients can read own transactions"
    on public.transactions
    for select
    to authenticated
    using (transactions.client_id = auth.uid());
end $$;

-- client_points: read-only policies for participants.
-- No UPDATE policy for authenticated users: only service role can update.
drop policy if exists "Clients can read own points" on public.client_points;
drop policy if exists "Providers can read points for their clients" on public.client_points;

do $$
begin
  create policy "Clients can read own points"
    on public.client_points
    for select
    to authenticated
    using (client_points.client_id = auth.uid());

  if to_regclass('public.fournisseurs') is not null then
    create policy "Providers can read points for their clients"
      on public.client_points
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = client_points.fournisseur_id
            and f.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Auto-cancel pending transactions after 5 minutes.
create or replace function public.cancel_expired_pending_transactions()
returns void
language plpgsql
as $$
begin
  if to_regclass('public.pending_transactions') is null then
    return;
  end if;

  update public.pending_transactions
  set status = 'cancelled'
  where status = 'pending'
    and expires_at <= now();
end;
$$;

-- Try scheduling with pg_cron when available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('cancel-expired-pending-transactions');

    perform cron.schedule(
      'cancel-expired-pending-transactions',
      '* * * * *',
      'select public.cancel_expired_pending_transactions();'
    );
  end if;
exception
  when others then
    null;
end $$;
