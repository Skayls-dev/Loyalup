-- Week 11: Configurable thematic networks

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Core network tables
-- -----------------------------------------------------------------------------
create table if not exists public.networks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name jsonb not null,
  description jsonb,
  tagline jsonb,
  emoji text not null,
  primary_color varchar(7) not null,
  secondary_color varchar(7),
  logo_url text,
  banner_url text,
  website_url text,

  category text not null,
  tags text[] not null default array[]::text[],

  membership_type text not null default 'validated',
  requires_validation boolean not null default true,
  max_members integer,
  allowed_countries text[],
  allowed_categories text[],
  provider_criteria jsonb not null default '{}'::jsonb,

  points_multiplier numeric not null default 1.0,
  multiplier_mode text not null default 'additive',
  coalition_enabled boolean not null default false,
  transfer_rate numeric not null default 1.0,
  platform_fee_pct numeric not null default 0.10,
  welcome_bonus_points integer not null default 0,

  client_access text not null default 'open',
  min_level_required integer not null default 1,
  client_invite_code text,
  max_clients integer,

  is_public boolean not null default true,
  is_featured boolean not null default false,
  show_member_map boolean not null default true,
  show_leaderboard boolean not null default true,
  show_member_count boolean not null default true,

  sponsor_name text,
  sponsor_logo_url text,
  sponsor_url text,
  is_sponsored boolean not null default false,
  sponsorship_expires_at timestamptz,

  is_active boolean not null default true,
  is_draft boolean not null default false,
  launched_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  member_count integer not null default 0,
  client_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint networks_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint networks_primary_color_hex check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint networks_secondary_color_hex check (
    secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  constraint networks_membership_type_check check (
    membership_type in ('open', 'invite_only', 'validated')
  ),
  constraint networks_category_check check (
    category in (
      'cultural',
      'environmental',
      'religious',
      'social',
      'geographic',
      'demographic',
      'professional',
      'educational',
      'custom'
    )
  ),
  constraint networks_multiplier_mode_check check (
    multiplier_mode in ('additive', 'compound')
  ),
  constraint networks_client_access_check check (
    client_access in ('open', 'invite', 'level_required', 'provider_only')
  ),
  constraint networks_points_multiplier_check check (points_multiplier >= 1.0),
  constraint networks_transfer_rate_check check (transfer_rate > 0 and transfer_rate <= 1.0),
  constraint networks_platform_fee_pct_check check (platform_fee_pct >= 0 and platform_fee_pct <= 1.0),
  constraint networks_welcome_bonus_points_check check (welcome_bonus_points >= 0),
  constraint networks_min_level_required_check check (min_level_required >= 1),
  constraint networks_max_members_check check (max_members is null or max_members > 0),
  constraint networks_max_clients_check check (max_clients is null or max_clients > 0)
);

create unique index if not exists uq_networks_client_invite_code_ci
  on public.networks ((lower(client_invite_code)))
  where client_invite_code is not null;

create index if not exists idx_networks_active_public
  on public.networks (is_active, is_public, is_featured);
create index if not exists idx_networks_category on public.networks (category);
create index if not exists idx_networks_tags on public.networks using gin (tags);

create table if not exists public.network_members (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  fournisseur_id uuid not null references public.fournisseurs(id) on delete cascade,
  status text not null default 'pending',
  request_message text,
  rejection_reason text,
  validated_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  left_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  invite_code text,
  created_at timestamptz not null default now(),
  unique(network_id, fournisseur_id),
  constraint network_members_status_check check (
    status in ('pending', 'active', 'rejected', 'suspended', 'left')
  )
);

create index if not exists idx_network_members_network_status
  on public.network_members (network_id, status);
create index if not exists idx_network_members_fournisseur_status
  on public.network_members (fournisseur_id, status);

create table if not exists public.network_clients (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  total_network_points integer not null default 0,
  total_network_transactions integer not null default 0,
  last_activity_at timestamptz,
  joined_at timestamptz not null default now(),
  unique(network_id, client_id),
  constraint network_clients_total_points_check check (total_network_points >= 0),
  constraint network_clients_total_transactions_check check (total_network_transactions >= 0)
);

create index if not exists idx_network_clients_network on public.network_clients (network_id);
create index if not exists idx_network_clients_client on public.network_clients (client_id);

create table if not exists public.network_point_events (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  fournisseur_id uuid references public.fournisseurs(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  base_points integer not null,
  bonus_points integer not null,
  multiplier_applied numeric not null,
  created_at timestamptz not null default now(),
  constraint network_point_events_base_points_check check (base_points >= 0),
  constraint network_point_events_bonus_points_check check (bonus_points >= 0),
  constraint network_point_events_multiplier_check check (multiplier_applied >= 1.0)
);

create index if not exists idx_network_point_events_network_created
  on public.network_point_events (network_id, created_at desc);
create index if not exists idx_network_point_events_client_created
  on public.network_point_events (client_id, created_at desc);

create table if not exists public.network_invitations (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  invite_code text not null,
  invite_type text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_email text,
  max_uses integer,
  current_uses integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint network_invitations_invite_type_check check (invite_type in ('provider', 'client')),
  constraint network_invitations_max_uses_check check (max_uses is null or max_uses > 0),
  constraint network_invitations_current_uses_check check (current_uses >= 0)
);

create unique index if not exists uq_network_invitations_invite_code_ci
  on public.network_invitations ((lower(invite_code)));

create index if not exists idx_network_invitations_network on public.network_invitations (network_id);
create index if not exists idx_network_invitations_active on public.network_invitations (is_active, expires_at);

create table if not exists public.network_announcements (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  title jsonb not null,
  content jsonb not null,
  emoji text,
  image_url text,
  cta_label jsonb,
  cta_url text,
  is_pinned boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_network_announcements_network_published
  on public.network_announcements (network_id, published_at desc);
create index if not exists idx_network_announcements_active_window
  on public.network_announcements (published_at, expires_at);

create table if not exists public.network_sponsorships (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  sponsor_name text not null,
  sponsor_logo_url text,
  sponsor_url text,
  contract_type text not null,
  amount numeric not null,
  currency varchar(3) not null default 'EUR',
  starts_at timestamptz not null,
  ends_at timestamptz,
  payment_status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  constraint network_sponsorships_contract_type_check check (
    contract_type in ('monthly', 'annual', 'per_transaction', 'grant')
  ),
  constraint network_sponsorships_payment_status_check check (
    payment_status in ('pending', 'active', 'expired', 'cancelled')
  ),
  constraint network_sponsorships_amount_check check (amount >= 0)
);

create index if not exists idx_network_sponsorships_network_status
  on public.network_sponsorships (network_id, payment_status);

create table if not exists public.network_multiplier_audit_logs (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  previous_multiplier numeric not null,
  new_multiplier numeric not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason text,
  constraint network_multiplier_audit_logs_values_check check (
    previous_multiplier >= 1.0 and new_multiplier >= 1.0
  )
);

create index if not exists idx_network_multiplier_audit_logs_network_changed
  on public.network_multiplier_audit_logs (network_id, changed_at desc);

-- -----------------------------------------------------------------------------
-- Triggers & functions
-- -----------------------------------------------------------------------------
create or replace function public.recompute_network_counters(p_network_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_network_id is null then
    return;
  end if;

  update public.networks n
  set
    member_count = (
      select count(*)
      from public.network_members nm
      where nm.network_id = p_network_id
        and nm.status = 'active'
    ),
    client_count = (
      select count(*)
      from public.network_clients nc
      where nc.network_id = p_network_id
    ),
    updated_at = now()
  where n.id = p_network_id;
end;
$$;

revoke all on function public.recompute_network_counters(uuid) from public;
grant execute on function public.recompute_network_counters(uuid) to authenticated;

drop trigger if exists trg_network_member_count on public.network_members;
drop trigger if exists trg_network_client_count on public.network_clients;

create or replace function public.update_network_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_network_counters(coalesce(new.network_id, old.network_id));

  if tg_op = 'UPDATE'
     and new.network_id is distinct from old.network_id then
    perform public.recompute_network_counters(old.network_id);
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_network_member_count
after insert or update or delete on public.network_members
for each row execute function public.update_network_counters();

create trigger trg_network_client_count
after insert or delete or update on public.network_clients
for each row execute function public.update_network_counters();

create or replace function public.set_network_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_networks_set_updated_at on public.networks;
create trigger trg_networks_set_updated_at
before update on public.networks
for each row
execute function public.set_network_updated_at();

create or replace function public.compute_network_bonus(
  p_fournisseur_id uuid,
  p_base_points integer
)
returns table(
  network_id uuid,
  network_name text,
  bonus_points integer,
  multiplier numeric
)
language sql
stable
set search_path = public
as $$
  select
    n.id as network_id,
    coalesce(n.name->>'fr', n.name->>'en', n.slug) as network_name,
    floor(p_base_points * (n.points_multiplier - 1))::integer as bonus_points,
    n.points_multiplier as multiplier
  from public.networks n
  join public.network_members nm on nm.network_id = n.id
  where nm.fournisseur_id = p_fournisseur_id
    and nm.status = 'active'
    and n.is_active = true
    and n.is_draft = false
    and (n.launched_at is null or n.launched_at <= now())
    and n.points_multiplier > 1.0;
$$;

revoke all on function public.compute_network_bonus(uuid, integer) from public;
grant execute on function public.compute_network_bonus(uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.networks enable row level security;
alter table public.network_members enable row level security;
alter table public.network_clients enable row level security;
alter table public.network_point_events enable row level security;
alter table public.network_invitations enable row level security;
alter table public.network_announcements enable row level security;
alter table public.network_sponsorships enable row level security;
alter table public.network_multiplier_audit_logs enable row level security;

-- networks

drop policy if exists "Public read active public networks" on public.networks;
create policy "Public read active public networks"
  on public.networks for select
  to public
  using (
    is_public = true
    and is_active = true
    and is_draft = false
    and (launched_at is null or launched_at <= now())
  );

drop policy if exists "Admins full manage networks" on public.networks;
create policy "Admins full manage networks"
  on public.networks for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- network_members

drop policy if exists "Providers read own network memberships" on public.network_members;
create policy "Providers read own network memberships"
  on public.network_members for select
  to authenticated
  using (fournisseur_id = public.current_provider_id());

drop policy if exists "Providers request own network membership" on public.network_members;
create policy "Providers request own network membership"
  on public.network_members for insert
  to authenticated
  with check (fournisseur_id = public.current_provider_id());

drop policy if exists "Admins full manage network members" on public.network_members;
create policy "Admins full manage network members"
  on public.network_members for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- network_clients

drop policy if exists "Clients read own network enrollments" on public.network_clients;
create policy "Clients read own network enrollments"
  on public.network_clients for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists "Clients enroll themselves in networks" on public.network_clients;
create policy "Clients enroll themselves in networks"
  on public.network_clients for insert
  to authenticated
  with check (client_id = auth.uid());

drop policy if exists "Admins full manage network clients" on public.network_clients;
create policy "Admins full manage network clients"
  on public.network_clients for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- network_point_events

drop policy if exists "Clients read own network point events" on public.network_point_events;
create policy "Clients read own network point events"
  on public.network_point_events for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists "Admins full manage network point events" on public.network_point_events;
create policy "Admins full manage network point events"
  on public.network_point_events for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- network_invitations

drop policy if exists "Invitation creators manage own invitations" on public.network_invitations;
create policy "Invitation creators manage own invitations"
  on public.network_invitations for all
  to authenticated
  using (invited_by = auth.uid())
  with check (invited_by = auth.uid());

drop policy if exists "Admins full manage network invitations" on public.network_invitations;
create policy "Admins full manage network invitations"
  on public.network_invitations for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- network_announcements

drop policy if exists "Public read active network announcements" on public.network_announcements;
create policy "Public read active network announcements"
  on public.network_announcements for select
  to public
  using (
    published_at <= now()
    and (expires_at is null or expires_at > now())
    and exists (
      select 1
      from public.networks n
      where n.id = network_id
        and n.is_public = true
        and n.is_active = true
        and n.is_draft = false
        and (n.launched_at is null or n.launched_at <= now())
    )
  );

drop policy if exists "Admins full manage network announcements" on public.network_announcements;
create policy "Admins full manage network announcements"
  on public.network_announcements for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- network_sponsorships

drop policy if exists "Admins full manage network sponsorships" on public.network_sponsorships;
create policy "Admins full manage network sponsorships"
  on public.network_sponsorships for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- network_multiplier_audit_logs

drop policy if exists "Admins read network multiplier audit" on public.network_multiplier_audit_logs;
create policy "Admins read network multiplier audit"
  on public.network_multiplier_audit_logs for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Admins insert network multiplier audit" on public.network_multiplier_audit_logs;
create policy "Admins insert network multiplier audit"
  on public.network_multiplier_audit_logs for insert
  to authenticated
  with check (public.is_current_user_admin());
