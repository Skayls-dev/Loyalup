create or replace function public.credit_points_transaction(
  p_provider_user_id uuid,
  p_pending_transaction_id uuid,
  p_montant numeric,
  p_service_id uuid default null
)
returns table (
  success boolean,
  points_credited integer,
  new_balance integer,
  transaction_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending public.pending_transactions%rowtype;
  v_provider public.fournisseurs%rowtype;
  v_service public.services%rowtype;
  v_points integer;
  v_transaction_id uuid;
  v_balance integer;
begin
  if p_montant is null or p_montant <= 0 then
    raise exception 'montant must be > 0';
  end if;

  select *
  into v_provider
  from public.fournisseurs
  where user_id = p_provider_user_id
  limit 1;

  if v_provider.id is null then
    raise exception 'Provider profile not found';
  end if;

  perform public.cancel_expired_pending_transactions();

  select *
  into v_pending
  from public.pending_transactions
  where id = p_pending_transaction_id
  for update;

  if v_pending.id is null then
    raise exception 'Pending transaction not found';
  end if;

  if v_pending.fournisseur_id <> v_provider.id then
    raise exception 'Forbidden';
  end if;

  if v_pending.status <> 'pending' then
    raise exception 'Pending transaction already %', v_pending.status;
  end if;

  if v_pending.expires_at <= now() then
    update public.pending_transactions
    set status = 'cancelled'
    where id = v_pending.id;

    raise exception 'Pending transaction expired';
  end if;

  if p_service_id is not null then
    select *
    into v_service
    from public.services
    where id = p_service_id
      and fournisseur_id = v_provider.id
      and actif = true
    limit 1;

    if v_service.id is null then
      raise exception 'Service not found for provider';
    end if;
  end if;

  v_points :=
    coalesce(
      v_service.points_defaut,
      floor(p_montant * coalesce(v_service.points_per_euro, 10))::integer
    );

  insert into public.transactions (
    pending_transaction_id,
    client_id,
    fournisseur_id,
    service_id,
    montant,
    points_credited,
    status
  )
  values (
    v_pending.id,
    v_pending.client_id,
    v_pending.fournisseur_id,
    p_service_id,
    p_montant,
    v_points,
    'validated'
  )
  returning id into v_transaction_id;

  update public.pending_transactions
  set status = 'validated'
  where id = v_pending.id;

  insert into public.client_points (
    client_id,
    fournisseur_id,
    solde,
    total_visites
  )
  values (
    v_pending.client_id,
    v_pending.fournisseur_id,
    v_points,
    1
  )
  on conflict (client_id, fournisseur_id)
  do update set
    solde = public.client_points.solde + excluded.solde,
    total_visites = public.client_points.total_visites + excluded.total_visites,
    updated_at = now();

  select cp.solde
  into v_balance
  from public.client_points cp
  where cp.client_id = v_pending.client_id
    and cp.fournisseur_id = v_pending.fournisseur_id
  limit 1;

  return query
  select true, v_points, coalesce(v_balance, v_points), v_transaction_id;
end;
$$;

revoke all on function public.credit_points_transaction(uuid, uuid, numeric, uuid) from public;
grant execute on function public.credit_points_transaction(uuid, uuid, numeric, uuid) to service_role;
