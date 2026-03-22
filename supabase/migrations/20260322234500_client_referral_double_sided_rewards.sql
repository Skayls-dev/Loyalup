-- Double-sided referral rewards:
-- when a referred client completes their first validated transaction,
-- both referred and referrer receive a one-time points bonus.

create or replace function public.process_client_referral_reward_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.client_referrals%rowtype;
  v_validated_count integer;
  v_reward_provider_id uuid;
  v_referrer_bonus integer := 100;
  v_referred_bonus integer := 100;
begin
  if new.status <> 'validated' then
    return new;
  end if;

  select count(*)
  into v_validated_count
  from public.transactions t
  where t.client_id = new.client_id
    and t.status = 'validated';

  -- Reward is granted only on the first validated transaction of the referred client.
  if v_validated_count <> 1 then
    return new;
  end if;

  select *
  into v_referral
  from public.client_referrals cr
  where cr.referred_id = new.client_id
    and cr.status = 'activated'
  order by cr.activated_at asc nulls last, cr.created_at asc
  limit 1
  for update;

  if v_referral.id is null then
    return new;
  end if;

  v_reward_provider_id := coalesce(v_referral.fournisseur_id, new.fournisseur_id);

  if v_reward_provider_id is null then
    return new;
  end if;

  insert into public.client_points (
    client_id,
    fournisseur_id,
    solde,
    total_visites
  )
  values (
    v_referral.referrer_id,
    v_reward_provider_id,
    v_referrer_bonus,
    0
  )
  on conflict (client_id, fournisseur_id)
  do update set
    solde = public.client_points.solde + excluded.solde,
    updated_at = now();

  insert into public.client_points (
    client_id,
    fournisseur_id,
    solde,
    total_visites
  )
  values (
    v_referral.referred_id,
    v_reward_provider_id,
    v_referred_bonus,
    0
  )
  on conflict (client_id, fournisseur_id)
  do update set
    solde = public.client_points.solde + excluded.solde,
    updated_at = now();

  update public.client_referrals
  set
    status = 'rewarded',
    points_awarded_referrer = v_referrer_bonus,
    points_awarded_referred = v_referred_bonus,
    rewarded_at = now()
  where id = v_referral.id;

  return new;
exception
  when others then
    raise warning 'process_client_referral_reward_on_transaction failed for tx %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_process_client_referral_reward on public.transactions;

create trigger trg_process_client_referral_reward
after insert on public.transactions
for each row
execute function public.process_client_referral_reward_on_transaction();
