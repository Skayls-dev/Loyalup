create extension if not exists pgcrypto;

alter table if exists public.qr_tokens
  add column if not exists status text not null default 'active';

alter table if exists public.qr_tokens
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.qr_tokens
  add column if not exists expires_at timestamptz not null default now() + interval '3 minutes';

alter table if exists public.qr_tokens
  add column if not exists token uuid not null default gen_random_uuid();

alter table if exists public.qr_tokens
  add constraint qr_tokens_status_check check (status in ('active', 'used', 'expired'));

alter table if exists public.qr_tokens
  add constraint qr_tokens_token_unique unique (token);

do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    alter table if exists public.qr_tokens
      drop constraint if exists qr_tokens_fournisseur_fk;

    alter table if exists public.qr_tokens
      add constraint qr_tokens_fournisseur_fk
      foreign key (fournisseur_id) references public.fournisseurs(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_qr_tokens_fournisseur_status
  on public.qr_tokens (fournisseur_id, status);

create index if not exists idx_qr_tokens_expires_at
  on public.qr_tokens (expires_at);

create table if not exists public.pending_transactions (
  id uuid primary key default gen_random_uuid(),
  qr_token_id uuid not null,
  client_id uuid not null,
  fournisseur_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'validated', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes'
);

do $$
begin
  alter table if exists public.pending_transactions
    drop constraint if exists pending_transactions_qr_token_fk;

  alter table if exists public.pending_transactions
    add constraint pending_transactions_qr_token_fk
    foreign key (qr_token_id) references public.qr_tokens(id) on delete cascade;

  if to_regclass('public.profiles') is not null then
    alter table if exists public.pending_transactions
      drop constraint if exists pending_transactions_client_fk;

    alter table if exists public.pending_transactions
      add constraint pending_transactions_client_fk
      foreign key (client_id) references public.profiles(id) on delete cascade;
  end if;

  if to_regclass('public.fournisseurs') is not null then
    alter table if exists public.pending_transactions
      drop constraint if exists pending_transactions_fournisseur_fk;

    alter table if exists public.pending_transactions
      add constraint pending_transactions_fournisseur_fk
      foreign key (fournisseur_id) references public.fournisseurs(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_pending_transactions_provider_status
  on public.pending_transactions (fournisseur_id, status);

create index if not exists idx_pending_transactions_client_status
  on public.pending_transactions (client_id, status);

create index if not exists idx_pending_transactions_expires_at
  on public.pending_transactions (expires_at);

alter table public.qr_tokens enable row level security;
alter table public.pending_transactions enable row level security;

drop policy if exists "Providers can read their own qr_tokens" on public.qr_tokens;
do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    create policy "Providers can read their own qr_tokens"
      on public.qr_tokens
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = qr_tokens.fournisseur_id
            and f.user_id = auth.uid()
        )
      );
  end if;
end $$;

drop policy if exists "Providers can insert their own qr_tokens" on public.qr_tokens;
do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    create policy "Providers can insert their own qr_tokens"
      on public.qr_tokens
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = qr_tokens.fournisseur_id
            and f.user_id = auth.uid()
        )
      );
  end if;
end $$;

drop policy if exists "Providers can update their own qr_tokens" on public.qr_tokens;
do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    create policy "Providers can update their own qr_tokens"
      on public.qr_tokens
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = qr_tokens.fournisseur_id
            and f.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = qr_tokens.fournisseur_id
            and f.user_id = auth.uid()
        )
      );
  end if;
end $$;

drop policy if exists "Participants can read pending transactions" on public.pending_transactions;
do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    create policy "Participants can read pending transactions"
      on public.pending_transactions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = pending_transactions.fournisseur_id
            and f.user_id = auth.uid()
        )
        or pending_transactions.client_id = auth.uid()
      );
  end if;
end $$;

drop policy if exists "Providers can update pending transactions" on public.pending_transactions;
do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    create policy "Providers can update pending transactions"
      on public.pending_transactions
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = pending_transactions.fournisseur_id
            and f.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = pending_transactions.fournisseur_id
            and f.user_id = auth.uid()
        )
      );
  end if;
end $$;
