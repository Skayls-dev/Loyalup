create extension if not exists pgcrypto;

create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null,
  token uuid not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz null,
  constraint qr_tokens_expires_after_created check (expires_at > created_at)
);

create index if not exists idx_qr_tokens_fournisseur_id on public.qr_tokens (fournisseur_id);
create index if not exists idx_qr_tokens_expires_at on public.qr_tokens (expires_at);

alter table public.qr_tokens enable row level security;

drop policy if exists "Providers can insert own QR tokens" on public.qr_tokens;
create policy "Providers can insert own QR tokens"
on public.qr_tokens
for insert
to authenticated
with check (auth.uid() = fournisseur_id);

drop policy if exists "Providers can read own QR tokens" on public.qr_tokens;
create policy "Providers can read own QR tokens"
on public.qr_tokens
for select
to authenticated
using (auth.uid() = fournisseur_id);
