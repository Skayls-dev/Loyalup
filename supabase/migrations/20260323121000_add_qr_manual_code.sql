alter table if exists public.qr_tokens
  add column if not exists manual_code text;

create index if not exists idx_qr_tokens_manual_code_status
  on public.qr_tokens (manual_code, status);

create index if not exists idx_qr_tokens_active_manual_code
  on public.qr_tokens (manual_code)
  where status = 'active' and manual_code is not null;

create or replace function public.generate_qr_manual_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_try int := 0;
begin
  loop
    v_try := v_try + 1;
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

    exit when not exists (
      select 1
      from public.qr_tokens
      where manual_code = v_code
        and status = 'active'
    );

    if v_try >= 20 then
      raise exception 'Unable to generate unique manual QR code';
    end if;
  end loop;

  return v_code;
end;
$$;

grant execute on function public.generate_qr_manual_code() to service_role;
