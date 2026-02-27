create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  fournisseur_id uuid not null,
  nom text not null,
  description text not null,
  points_required integer not null check (points_required > 0),
  emoji text not null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.client_rewards (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  fournisseur_id uuid not null,
  reward_rule_id uuid not null,
  status text not null check (status in ('available', 'used', 'expired')),
  unlocked_at timestamptz not null default now(),
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (client_id, reward_rule_id)
);

create index if not exists idx_reward_rules_fournisseur_actif_points
  on public.reward_rules (fournisseur_id, actif, points_required);
create index if not exists idx_client_rewards_client_fournisseur_status
  on public.client_rewards (client_id, fournisseur_id, status, unlocked_at desc);
create index if not exists idx_client_rewards_reward_rule
  on public.client_rewards (reward_rule_id);

-- FKs are added only if referenced tables exist in current environment.
do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    alter table if exists public.reward_rules
      drop constraint if exists reward_rules_fournisseur_fk;

    alter table if exists public.reward_rules
      add constraint reward_rules_fournisseur_fk
      foreign key (fournisseur_id) references public.fournisseurs(id) on delete cascade;

    alter table if exists public.client_rewards
      drop constraint if exists client_rewards_fournisseur_fk;

    alter table if exists public.client_rewards
      add constraint client_rewards_fournisseur_fk
      foreign key (fournisseur_id) references public.fournisseurs(id) on delete cascade;
  end if;

  if to_regclass('public.profiles') is not null then
    alter table if exists public.client_rewards
      drop constraint if exists client_rewards_client_fk;

    alter table if exists public.client_rewards
      add constraint client_rewards_client_fk
      foreign key (client_id) references public.profiles(id) on delete cascade;
  end if;

  if to_regclass('public.reward_rules') is not null then
    alter table if exists public.client_rewards
      drop constraint if exists client_rewards_reward_rule_fk;

    alter table if exists public.client_rewards
      add constraint client_rewards_reward_rule_fk
      foreign key (reward_rule_id) references public.reward_rules(id) on delete cascade;
  end if;
end $$;

alter table public.reward_rules enable row level security;
alter table public.client_rewards enable row level security;

-- reward_rules: providers can CRUD their own rules; clients can read all active/inactive rules.
drop policy if exists "Providers can read own reward rules" on public.reward_rules;
drop policy if exists "Providers can insert own reward rules" on public.reward_rules;
drop policy if exists "Providers can update own reward rules" on public.reward_rules;
drop policy if exists "Providers can delete own reward rules" on public.reward_rules;
drop policy if exists "Clients can read all reward rules" on public.reward_rules;

do $$
begin
  if to_regclass('public.fournisseurs') is not null then
    create policy "Providers can read own reward rules"
      on public.reward_rules
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = reward_rules.fournisseur_id
            and f.user_id = auth.uid()
        )
      );

    create policy "Providers can insert own reward rules"
      on public.reward_rules
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = reward_rules.fournisseur_id
            and f.user_id = auth.uid()
        )
      );

    create policy "Providers can update own reward rules"
      on public.reward_rules
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = reward_rules.fournisseur_id
            and f.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = reward_rules.fournisseur_id
            and f.user_id = auth.uid()
        )
      );

    create policy "Providers can delete own reward rules"
      on public.reward_rules
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.fournisseurs f
          where f.id = reward_rules.fournisseur_id
            and f.user_id = auth.uid()
        )
      );
  end if;

  create policy "Clients can read all reward rules"
    on public.reward_rules
    for select
    to authenticated
    using (true);
end $$;

-- client_rewards: clients can only read their own rewards.
-- No INSERT/UPDATE policy for authenticated users: only service role can write.
drop policy if exists "Clients can read own rewards" on public.client_rewards;
create policy "Clients can read own rewards"
  on public.client_rewards
  for select
  to authenticated
  using (client_rewards.client_id = auth.uid());

create or replace function public.check_and_unlock_rewards(
  p_client_id uuid,
  p_fournisseur_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solde integer;
  v_unlocked_count integer;
begin
  if p_client_id is null or p_fournisseur_id is null then
    return 0;
  end if;

  select cp.solde
  into v_solde
  from public.client_points cp
  where cp.client_id = p_client_id
    and cp.fournisseur_id = p_fournisseur_id
  limit 1;

  if coalesce(v_solde, 0) <= 0 then
    return 0;
  end if;

  with inserted as (
    insert into public.client_rewards (
      client_id,
      fournisseur_id,
      reward_rule_id,
      status,
      unlocked_at
    )
    select
      p_client_id,
      p_fournisseur_id,
      rr.id,
      'available',
      now()
    from public.reward_rules rr
    where rr.fournisseur_id = p_fournisseur_id
      and rr.actif = true
      and rr.points_required <= v_solde
      and not exists (
        select 1
        from public.client_rewards cr
        where cr.client_id = p_client_id
          and cr.fournisseur_id = p_fournisseur_id
          and cr.reward_rule_id = rr.id
      )
    returning 1
  )
  select count(*)::integer
  into v_unlocked_count
  from inserted;

  return coalesce(v_unlocked_count, 0);
end;
$$;

revoke all on function public.check_and_unlock_rewards(uuid, uuid) from public;
grant execute on function public.check_and_unlock_rewards(uuid, uuid) to service_role;
