do $$
begin
  if exists (
    select 1
    from public.pending_transactions
    group by qr_token_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate pending_transactions exist for a QR token; reconcile them before applying this migration';
  end if;
end;
$$;

create unique index if not exists uq_pending_transactions_qr_token
  on public.pending_transactions (qr_token_id);

create or replace function public.consume_qr_token(
  p_client_id uuid,
  p_token_input text
)
returns table (
  fournisseur_id uuid,
  transaction_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_candidate public.qr_tokens%rowtype;
  v_consumed_token public.qr_tokens%rowtype;
  v_transaction_id uuid;
  v_normalized text;
  v_manual_code text;
begin
  if p_client_id is null then
    raise exception 'CLIENT_REQUIRED';
  end if;

  v_normalized := trim(coalesce(p_token_input, ''));
  if v_normalized = '' or length(v_normalized) > 100 then
    raise exception 'INVALID_TOKEN';
  end if;

  if v_normalized ~ '^[0-9]{6}$' then
    v_manual_code := v_normalized;
  else
    v_manual_code := null;
  end if;

  select qt.*
  into v_token_candidate
  from public.qr_tokens qt
  where qt.token::text = v_normalized
     or (v_manual_code is not null and qt.manual_code = v_manual_code)
  order by
    case when qt.token::text = v_normalized then 0 else 1 end,
    qt.created_at desc
  limit 1;

  if v_token_candidate.id is null then
    raise exception 'TOKEN_NOT_FOUND';
  end if;

  update public.qr_tokens
  set status = 'used'
  where id = v_token_candidate.id
    and status = 'active'
    and expires_at > now()
  returning * into v_consumed_token;

  if v_consumed_token.id is null then
    if v_token_candidate.expires_at <= now() then
      update public.qr_tokens
      set status = 'expired'
      where id = v_token_candidate.id
        and status = 'active';

      raise exception 'TOKEN_EXPIRED';
    end if;

    raise exception 'TOKEN_USED';
  end if;

  insert into public.pending_transactions (
    qr_token_id,
    client_id,
    fournisseur_id,
    status,
    expires_at
  )
  values (
    v_consumed_token.id,
    p_client_id,
    v_consumed_token.fournisseur_id,
    'pending',
    now() + interval '5 minutes'
  )
  returning id into v_transaction_id;

  return query select v_consumed_token.fournisseur_id, v_transaction_id;
end;
$$;

revoke all on function public.consume_qr_token(uuid, text) from public;
revoke all on function public.consume_qr_token(uuid, text) from anon;
revoke all on function public.consume_qr_token(uuid, text) from authenticated;
grant execute on function public.consume_qr_token(uuid, text) to service_role;