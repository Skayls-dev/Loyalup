create extension if not exists pgcrypto;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_user_id uuid,
  success boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at desc);
create index if not exists idx_admin_audit_logs_admin_user on public.admin_audit_logs(admin_user_id);
create index if not exists idx_admin_audit_logs_target_user on public.admin_audit_logs(target_user_id);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admins read audit logs" on public.admin_audit_logs;
create policy "Admins read audit logs"
  on public.admin_audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

revoke all on public.admin_audit_logs from anon, authenticated;
grant select on public.admin_audit_logs to authenticated;
