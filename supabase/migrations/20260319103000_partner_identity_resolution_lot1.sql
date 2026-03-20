create table if not exists public.partner_identity_cases (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  external_user_id text not null,
  candidate_loyalup_user_id uuid references public.profiles(id) on delete set null,
  resolved_loyalup_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'resolved', 'conflict', 'merged', 'rejected')),
  decision text not null default 'create_shadow'
    check (decision in ('create_shadow', 'adopt_existing', 'merge_required', 'blocked_conflict')),
  requested_email text,
  requested_display_name text,
  conflict_reason text,
  source text not null default 'partner-api',
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (partner_id, external_user_id, created_at)
);

create index if not exists idx_partner_identity_cases_partner_external
  on public.partner_identity_cases(partner_id, external_user_id, created_at desc);

create index if not exists idx_partner_identity_cases_status
  on public.partner_identity_cases(status, created_at desc);

create index if not exists idx_partner_identity_cases_resolved_user
  on public.partner_identity_cases(resolved_loyalup_user_id, created_at desc);

create unique index if not exists uq_partner_identity_case_open
  on public.partner_identity_cases(partner_id, external_user_id)
  where status in ('pending_verification', 'conflict');

drop trigger if exists trg_partner_identity_cases_updated_at on public.partner_identity_cases;
create trigger trg_partner_identity_cases_updated_at
before update on public.partner_identity_cases
for each row
execute function public.set_updated_at();

create table if not exists public.partner_identity_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.partner_identity_cases(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  external_user_id text not null,
  event_type text not null check (
    event_type in (
      'case_opened',
      'decision_computed',
      'verification_sent',
      'verification_succeeded',
      'verification_failed',
      'linked',
      'conflict_detected',
      'merge_requested',
      'merged',
      'rejected',
      'closed',
      'note_added'
    )
  ),
  from_status text,
  to_status text,
  actor_type text not null default 'system'
    check (actor_type in ('system', 'partner', 'user', 'admin')),
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_identity_events_case_created
  on public.partner_identity_events(case_id, created_at desc);

create index if not exists idx_partner_identity_events_partner_external
  on public.partner_identity_events(partner_id, external_user_id, created_at desc);

create index if not exists idx_partner_identity_events_type_created
  on public.partner_identity_events(event_type, created_at desc);

alter table public.partner_user_links
  add column if not exists link_status text not null default 'active'
    check (link_status in ('active', 'pending_verification', 'conflict', 'merged', 'revoked')),
  add column if not exists link_method text not null default 'auto_create'
    check (link_method in ('auto_create', 'adopt_existing', 'merge', 'manual_admin')),
  add column if not exists verified_at timestamptz,
  add column if not exists last_status_change_at timestamptz not null default now(),
  add column if not exists merged_into_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists conflict_reason text,
  add column if not exists source text not null default 'partner-api';

create unique index if not exists uq_partner_link_partner_loyalup_active
  on public.partner_user_links(partner_id, loyalup_user_id)
  where link_status in ('active', 'pending_verification');

create index if not exists idx_partner_user_links_status
  on public.partner_user_links(link_status, last_status_change_at desc);

create index if not exists idx_partner_user_links_source
  on public.partner_user_links(source);

create or replace view public.partner_identity_status as
select
  l.partner_id,
  l.external_user_id,
  l.loyalup_user_id,
  l.link_status,
  l.link_method,
  l.verified_at,
  l.last_status_change_at,
  l.conflict_reason as link_conflict_reason,
  c.id as open_case_id,
  c.status as case_status,
  c.decision as case_decision,
  c.conflict_reason as case_conflict_reason,
  c.updated_at as case_updated_at,
  coalesce(
    c.status,
    case l.link_status
      when 'active' then 'resolved'
      when 'pending_verification' then 'pending_verification'
      when 'conflict' then 'conflict'
      when 'merged' then 'merged'
      when 'revoked' then 'rejected'
      else 'pending_verification'
    end
  ) as current_status
from public.partner_user_links l
left join lateral (
  select id, status, decision, conflict_reason, updated_at
  from public.partner_identity_cases c
  where c.partner_id = l.partner_id
    and c.external_user_id = l.external_user_id
    and c.status in ('pending_verification', 'conflict')
  order by c.updated_at desc
  limit 1
) c on true;