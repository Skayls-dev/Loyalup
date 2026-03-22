create or replace function public.sync_reward_rule_unlocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.actif, false) = false then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.fournisseur_id = old.fournisseur_id
     and new.points_required = old.points_required
     and coalesce(new.actif, false) = coalesce(old.actif, false) then
    return new;
  end if;

  insert into public.client_rewards (
    client_id,
    fournisseur_id,
    reward_rule_id,
    status,
    unlocked_at
  )
  select
    cp.client_id,
    new.fournisseur_id,
    new.id,
    'available',
    now()
  from public.client_points cp
  where cp.fournisseur_id = new.fournisseur_id
    and cp.solde >= new.points_required
    and not exists (
      select 1
      from public.client_rewards cr
      where cr.client_id = cp.client_id
        and cr.reward_rule_id = new.id
    )
  on conflict (client_id, reward_rule_id) do nothing;

  return new;
end;
$$;

revoke all on function public.sync_reward_rule_unlocks() from public;

drop trigger if exists trg_reward_rule_unlocks on public.reward_rules;
create trigger trg_reward_rule_unlocks
  after insert or update of actif, points_required, fournisseur_id
  on public.reward_rules
  for each row
  execute function public.sync_reward_rule_unlocks();

insert into public.client_rewards (
  client_id,
  fournisseur_id,
  reward_rule_id,
  status,
  unlocked_at
)
select
  cp.client_id,
  rr.fournisseur_id,
  rr.id,
  'available',
  now()
from public.client_points cp
join public.reward_rules rr
  on rr.fournisseur_id = cp.fournisseur_id
where rr.actif = true
  and cp.solde >= rr.points_required
  and not exists (
    select 1
    from public.client_rewards cr
    where cr.client_id = cp.client_id
      and cr.reward_rule_id = rr.id
  )
on conflict (client_id, reward_rule_id) do nothing;