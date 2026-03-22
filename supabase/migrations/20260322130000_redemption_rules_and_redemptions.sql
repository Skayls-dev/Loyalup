alter table if exists public.fournisseurs
  add column if not exists points_conversion_rate numeric not null default 100;

create table if not exists public.redemption_rules (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  label text not null,
  points_cost integer not null check (points_cost > 0),
  discount_value numeric not null,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  max_discount_eur numeric,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id),
  fournisseur_id uuid not null references public.fournisseurs(id),
  redemption_rule_id uuid references public.redemption_rules(id),
  points_deducted integer not null,
  discount_applied numeric not null,
  pending_transaction_id uuid references public.pending_transactions(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_redemption_rules_fournisseur_id
  on public.redemption_rules (fournisseur_id);

create index if not exists idx_redemptions_client_id
  on public.redemptions (client_id);

create index if not exists idx_redemptions_fournisseur_id
  on public.redemptions (fournisseur_id);

create index if not exists idx_redemptions_rule_id
  on public.redemptions (redemption_rule_id);

alter table public.redemption_rules enable row level security;
alter table public.redemptions enable row level security;

drop policy if exists redemption_rules_select_own_fournisseur on public.redemption_rules;
create policy redemption_rules_select_own_fournisseur
  on public.redemption_rules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = redemption_rules.fournisseur_id
        and f.user_id = auth.uid()
    )
  );

drop policy if exists redemption_rules_insert_own_fournisseur on public.redemption_rules;
create policy redemption_rules_insert_own_fournisseur
  on public.redemption_rules
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = redemption_rules.fournisseur_id
        and f.user_id = auth.uid()
    )
  );

drop policy if exists redemption_rules_update_own_fournisseur on public.redemption_rules;
create policy redemption_rules_update_own_fournisseur
  on public.redemption_rules
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = redemption_rules.fournisseur_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.fournisseurs f
      where f.id = redemption_rules.fournisseur_id
        and f.user_id = auth.uid()
    )
  );

drop policy if exists redemptions_select_own_client on public.redemptions;
create policy redemptions_select_own_client
  on public.redemptions
  for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists redemption_rules_service_role_all on public.redemption_rules;
create policy redemption_rules_service_role_all
  on public.redemption_rules
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists redemptions_service_role_all on public.redemptions;
create policy redemptions_service_role_all
  on public.redemptions
  for all
  to service_role
  using (true)
  with check (true);