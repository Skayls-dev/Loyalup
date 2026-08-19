alter table public.point_transfers
  add column if not exists idempotency_key text;

create unique index if not exists uq_point_transfers_client_idempotency
  on public.point_transfers (client_id, idempotency_key)
  where idempotency_key is not null;

drop policy if exists "System insert transfers" on public.point_transfers;

create or replace function public.transfer_points_transaction(
  p_client_id uuid,
  p_from_fournisseur_id uuid,
  p_to_fournisseur_id uuid,
  p_points_to_transfer integer,
  p_idempotency_key text
)
returns table (
  points_deducted integer,
  platform_fee integer,
  points_credited integer,
  conversion_rate numeric,
  from_new_balance integer,
  to_new_balance integer,
  transfer_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.point_transfers%rowtype;
  v_coalition public.provider_coalitions%rowtype;
  v_source_balance integer;
  v_destination_balance integer;
  v_platform_fee integer;
  v_points_credited integer;
  v_transfer_id uuid;
begin
  if p_client_id is null then
    raise exception 'CLIENT_REQUIRED';
  end if;

  if p_from_fournisseur_id is null or p_to_fournisseur_id is null then
    raise exception 'PROVIDER_REQUIRED';
  end if;

  if p_from_fournisseur_id = p_to_fournisseur_id then
    raise exception 'SAME_PROVIDER';
  end if;

  if p_points_to_transfer is null or p_points_to_transfer <= 0 then
    raise exception 'INVALID_POINTS';
  end if;

  if p_idempotency_key is null
    or length(trim(p_idempotency_key)) < 8
    or length(trim(p_idempotency_key)) > 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  -- Prevent concurrent transfers for one client from overspending or deadlocking.
  perform pg_advisory_xact_lock(
    hashtextextended('point-transfer-client:' || p_client_id::text, 0)
  );

  -- Serialize all retries carrying the same client/key pair before reading state.
  perform pg_advisory_xact_lock(
    hashtextextended(p_client_id::text || ':' || trim(p_idempotency_key), 0)
  );

  select *
  into v_existing
  from public.point_transfers
  where client_id = p_client_id
    and idempotency_key = trim(p_idempotency_key)
  limit 1;

  if v_existing.id is not null then
    if v_existing.from_fournisseur_id <> p_from_fournisseur_id
      or v_existing.to_fournisseur_id <> p_to_fournisseur_id
      or v_existing.points_deducted <> p_points_to_transfer then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;

    select solde
    into v_source_balance
    from public.client_points
    where client_id = p_client_id
      and fournisseur_id = p_from_fournisseur_id;

    select solde
    into v_destination_balance
    from public.client_points
    where client_id = p_client_id
      and fournisseur_id = p_to_fournisseur_id;

    return query select
      v_existing.points_deducted,
      v_existing.platform_fee_points,
      v_existing.points_credited,
      v_existing.conversion_rate,
      coalesce(v_source_balance, 0),
      coalesce(v_destination_balance, 0),
      v_existing.id,
      true;
    return;
  end if;

  select pc.*
  into v_coalition
  from public.coalition_members source_member
  join public.coalition_members destination_member
    on destination_member.coalition_id = source_member.coalition_id
  join public.provider_coalitions pc
    on pc.id = source_member.coalition_id
  where source_member.fournisseur_id = p_from_fournisseur_id
    and source_member.status = 'active'
    and destination_member.fournisseur_id = p_to_fournisseur_id
    and destination_member.status = 'active'
    and pc.is_active = true
  order by pc.created_at
  limit 1;

  if v_coalition.id is null then
    raise exception 'COALITION_NOT_FOUND';
  end if;

  select solde
  into v_source_balance
  from public.client_points
  where client_id = p_client_id
    and fournisseur_id = p_from_fournisseur_id
  for update;

  if v_source_balance is null or v_source_balance < p_points_to_transfer then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  insert into public.client_points (client_id, fournisseur_id, solde, total_visites)
  values (p_client_id, p_to_fournisseur_id, 0, 0)
  on conflict (client_id, fournisseur_id) do nothing;

  select solde
  into v_destination_balance
  from public.client_points
  where client_id = p_client_id
    and fournisseur_id = p_to_fournisseur_id
  for update;

  v_platform_fee := floor(
    p_points_to_transfer * coalesce(v_coalition.platform_fee_pct, 0.10)
  )::integer;
  v_points_credited := floor(
    (p_points_to_transfer - v_platform_fee) * coalesce(v_coalition.conversion_rate, 1.0)
  )::integer;

  if v_points_credited < 0 then
    raise exception 'INVALID_COALITION_CONFIGURATION';
  end if;

  update public.client_points
  set solde = solde - p_points_to_transfer
  where client_id = p_client_id
    and fournisseur_id = p_from_fournisseur_id;

  update public.client_points
  set solde = solde + v_points_credited
  where client_id = p_client_id
    and fournisseur_id = p_to_fournisseur_id;

  insert into public.point_transfers (
    client_id,
    from_fournisseur_id,
    to_fournisseur_id,
    coalition_id,
    points_deducted,
    points_credited,
    platform_fee_points,
    conversion_rate,
    idempotency_key
  )
  values (
    p_client_id,
    p_from_fournisseur_id,
    p_to_fournisseur_id,
    v_coalition.id,
    p_points_to_transfer,
    v_points_credited,
    v_platform_fee,
    coalesce(v_coalition.conversion_rate, 1.0),
    trim(p_idempotency_key)
  )
  returning id into v_transfer_id;

  return query select
    p_points_to_transfer,
    v_platform_fee,
    v_points_credited,
    coalesce(v_coalition.conversion_rate, 1.0),
    v_source_balance - p_points_to_transfer,
    v_destination_balance + v_points_credited,
    v_transfer_id,
    false;
end;
$$;

revoke all on function public.transfer_points_transaction(uuid, uuid, uuid, integer, text) from public;
grant execute on function public.transfer_points_transaction(uuid, uuid, uuid, integer, text) to service_role;