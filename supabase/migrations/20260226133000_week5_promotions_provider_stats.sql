create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null,
  titre text not null,
  description text not null,
  emoji text not null,
  type text not null check (type in ('double_points', 'discount', 'free_item', 'custom')),
  valeur numeric null,
  date_debut timestamptz not null,
  date_fin timestamptz not null,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  check (date_fin > date_debut)
);

create index if not exists idx_promotions_fournisseur_id on public.promotions (fournisseur_id);
create index if not exists idx_promotions_active_window
  on public.promotions (actif, date_debut, date_fin);

-- FK is added only if referenced table exists in current environment.
do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    alter table if exists public.promotions
      drop constraint if exists promotions_fournisseur_fk;

    alter table if exists public.promotions
      add constraint promotions_fournisseur_fk
      foreign key (fournisseur_id) references public.fournisseurs(id) on delete cascade;
  end if;
end $$;

alter table public.promotions enable row level security;

-- promotions: providers can CRUD their own promotions
drop policy if exists "Providers can read own promotions" on public.promotions;
drop policy if exists "Providers can insert own promotions" on public.promotions;
drop policy if exists "Providers can update own promotions" on public.promotions;
drop policy if exists "Providers can delete own promotions" on public.promotions;

-- clients can read only currently active promotions
drop policy if exists "Clients can read active promotions in date window" on public.promotions;

do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    create policy "Providers can read own promotions"
      on public.promotions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = promotions.fournisseur_id
            and f.user_id = auth.uid()
        )
      );

    create policy "Providers can insert own promotions"
      on public.promotions
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = promotions.fournisseur_id
            and f.user_id = auth.uid()
        )
      );

    create policy "Providers can update own promotions"
      on public.promotions
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = promotions.fournisseur_id
            and f.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = promotions.fournisseur_id
            and f.user_id = auth.uid()
        )
      );

    create policy "Providers can delete own promotions"
      on public.promotions
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = promotions.fournisseur_id
            and f.user_id = auth.uid()
        )
      );
  end if;

  create policy "Clients can read active promotions in date window"
    on public.promotions
    for select
    to authenticated
    using (
      promotions.actif = true
      and now() >= promotions.date_debut
      and now() <= promotions.date_fin
    );
end $$;

create or replace view public.active_promotions
with (security_invoker = true)
as
select
  p.id,
  p.fournisseur_id,
  p.titre,
  p.description,
  p.emoji,
  p.type,
  p.valeur,
  p.date_debut,
  p.date_fin,
  p.actif,
  p.created_at
from public.promotions p
where p.actif = true
  and now() >= p.date_debut
  and now() <= p.date_fin;

create or replace function public.get_provider_stats(p_fournisseur_id uuid)
returns table (
  total_clients bigint,
  total_transactions bigint,
  total_points_distributed bigint,
  transactions_today bigint,
  revenue_today numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_authorized boolean;
begin
  if p_fournisseur_id is null then
    raise exception 'fournisseur_id is required';
  end if;

  if auth.role() = 'service_role' then
    v_is_authorized := true;
  else
    select exists (
      select 1
      from public.fournisseurs f
      where f.id = p_fournisseur_id
        and f.user_id = auth.uid()
    )
    into v_is_authorized;
  end if;

  if not coalesce(v_is_authorized, false) then
    raise exception 'Forbidden';
  end if;

  return query
  with base_transactions as (
    select t.*
    from public.transactions t
    where t.fournisseur_id = p_fournisseur_id
      and t.status = 'validated'
  )
  select
    (
      select count(distinct cp.client_id)
      from public.client_points cp
      where cp.fournisseur_id = p_fournisseur_id
    ) as total_clients,
    (
      select count(*)
      from base_transactions bt
    ) as total_transactions,
    (
      select coalesce(sum(bt.points_credited), 0)::bigint
      from base_transactions bt
    ) as total_points_distributed,
    (
      select count(*)
      from base_transactions bt
      where bt.created_at >= date_trunc('day', now())
        and bt.created_at < date_trunc('day', now()) + interval '1 day'
    ) as transactions_today,
    (
      select coalesce(sum(bt.montant), 0)
      from base_transactions bt
      where bt.created_at >= date_trunc('day', now())
        and bt.created_at < date_trunc('day', now()) + interval '1 day'
    ) as revenue_today;
end;
$$;

revoke all on function public.get_provider_stats(uuid) from public;
grant execute on function public.get_provider_stats(uuid) to authenticated, service_role;
