create or replace function public.consume_client_reward(
  p_client_reward_id uuid,
  p_client_id uuid
)
returns table (
  success boolean,
  points_deducted integer,
  new_balance integer,
  reward_rule_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.client_rewards%rowtype;
  v_rule public.reward_rules%rowtype;
  v_points public.client_points%rowtype;
  v_new_balance integer;
begin
  if p_client_reward_id is null or p_client_id is null then
    raise exception 'client_reward_id and client_id are required';
  end if;

  select *
  into v_reward
  from public.client_rewards
  where id = p_client_reward_id
  for update;

  if v_reward.id is null then
    raise exception 'Reward not found';
  end if;

  if v_reward.client_id <> p_client_id then
    raise exception 'Forbidden';
  end if;

  if v_reward.status <> 'available' then
    raise exception 'Reward is not available';
  end if;

  select *
  into v_rule
  from public.reward_rules
  where id = v_reward.reward_rule_id
    and actif = true
  limit 1;

  if v_rule.id is null then
    raise exception 'Reward rule not found';
  end if;

  select *
  into v_points
  from public.client_points
  where client_id = p_client_id
    and fournisseur_id = v_reward.fournisseur_id
  for update;

  if v_points.id is null then
    raise exception 'Points balance not found';
  end if;

  if v_points.solde < v_rule.points_required then
    raise exception 'Insufficient points balance';
  end if;

  update public.client_rewards
  set status = 'used',
      used_at = now()
  where id = v_reward.id;

  update public.client_points
  set solde = solde - v_rule.points_required,
      updated_at = now()
  where id = v_points.id
  returning solde into v_new_balance;

  return query
  select true, v_rule.points_required, v_new_balance, v_rule.id;
end;
$$;

revoke all on function public.consume_client_reward(uuid, uuid) from public;
grant execute on function public.consume_client_reward(uuid, uuid) to service_role;
