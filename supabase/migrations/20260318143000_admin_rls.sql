create or replace function public.request_jwt_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    ''
  )
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.request_jwt_role() = 'super_admin'
$$;

alter table public.networks enable row level security;

drop policy if exists networks_read_active on public.networks;
create policy networks_read_active on public.networks
for select
using (
  is_active = true
  or public.is_super_admin()
);

drop policy if exists networks_admin_write on public.networks;
create policy networks_admin_write on public.networks
for all
using (public.is_super_admin())
with check (public.is_super_admin());

do $$
begin
  if to_regclass('public.network_config') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'network_config'
        and column_name = 'network_id'
    ) then
    execute 'alter table public.network_config enable row level security';
    execute 'drop policy if exists network_config_read_active on public.network_config';
    execute $policy$
      create policy network_config_read_active on public.network_config
      for select
      using (
        exists (
          select 1
          from public.networks n
          where n.id = network_config.network_id
            and (n.is_active = true or public.is_super_admin())
        )
      )
    $policy$;
    execute 'drop policy if exists network_config_admin_write on public.network_config';
    execute $policy$
      create policy network_config_admin_write on public.network_config
      for all
      using (public.is_super_admin())
      with check (public.is_super_admin())
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.merchant_networks') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'merchant_networks'
        and column_name = 'merchant_id'
    ) then
    execute 'alter table public.merchant_networks enable row level security';
    execute 'drop policy if exists merchant_networks_manage_own on public.merchant_networks';
    execute $policy$
      create policy merchant_networks_manage_own on public.merchant_networks
      for all
      using (
        merchant_id = auth.uid()
        or public.is_super_admin()
      )
      with check (
        merchant_id = auth.uid()
        or public.is_super_admin()
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.network_members') is not null then
    execute 'alter table public.network_members enable row level security';
    execute 'drop policy if exists network_members_manage_own on public.network_members';
    execute $policy$
      create policy network_members_manage_own on public.network_members
      for all
      using (
        public.is_super_admin()
        or exists (
          select 1
          from public.fournisseurs f
          where f.id = network_members.fournisseur_id
            and f.user_id = auth.uid()
        )
      )
      with check (
        public.is_super_admin()
        or exists (
          select 1
          from public.fournisseurs f
          where f.id = network_members.fournisseur_id
            and f.user_id = auth.uid()
        )
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.tiers') is not null then
    execute 'alter table public.tiers enable row level security';
    execute 'drop policy if exists tiers_read_active on public.tiers';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tiers'
        and column_name = 'network_id'
    ) then
      execute $policy$
        create policy tiers_read_active on public.tiers
        for select
        using (
          exists (
            select 1
            from public.networks n
            where n.id = tiers.network_id
              and (n.is_active = true or public.is_super_admin())
          )
          or public.is_super_admin()
        )
      $policy$;
    else
      execute $policy$
        create policy tiers_read_active on public.tiers
        for select
        using (public.is_super_admin())
      $policy$;
    end if;
    execute 'drop policy if exists tiers_admin_write on public.tiers';
    execute $policy$
      create policy tiers_admin_write on public.tiers
      for all
      using (public.is_super_admin())
      with check (public.is_super_admin())
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.institutional_partners') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'institutional_partners'
        and column_name = 'network_id'
    ) then
    execute 'alter table public.institutional_partners enable row level security';
    execute 'drop policy if exists institutional_partners_read_active on public.institutional_partners';
    execute $policy$
      create policy institutional_partners_read_active on public.institutional_partners
      for select
      using (
        exists (
          select 1
          from public.networks n
          where n.id = institutional_partners.network_id
            and (n.is_active = true or public.is_super_admin())
        )
      )
    $policy$;
    execute 'drop policy if exists institutional_partners_admin_write on public.institutional_partners';
    execute $policy$
      create policy institutional_partners_admin_write on public.institutional_partners
      for all
      using (public.is_super_admin())
      with check (public.is_super_admin())
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.institution_network_access') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'institution_network_access'
        and column_name = 'network_id'
    ) then
    execute 'alter table public.institution_network_access enable row level security';
    execute 'drop policy if exists institution_network_access_read_active on public.institution_network_access';
    execute $policy$
      create policy institution_network_access_read_active on public.institution_network_access
      for select
      using (
        exists (
          select 1
          from public.networks n
          where n.id = institution_network_access.network_id
            and (n.is_active = true or public.is_super_admin())
        )
      )
    $policy$;
    execute 'drop policy if exists institution_network_access_admin_write on public.institution_network_access';
    execute $policy$
      create policy institution_network_access_admin_write on public.institution_network_access
      for all
      using (public.is_super_admin())
      with check (public.is_super_admin())
    $policy$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.network_features') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'network_features'
        and column_name = 'network_id'
    ) then
    execute 'alter table public.network_features enable row level security';
    execute 'drop policy if exists network_features_read_active on public.network_features';
    execute $policy$
      create policy network_features_read_active on public.network_features
      for select
      using (
        exists (
          select 1
          from public.networks n
          where n.id = network_features.network_id
            and (n.is_active = true or public.is_super_admin())
        )
      )
    $policy$;
    execute 'drop policy if exists network_features_admin_write on public.network_features';
    execute $policy$
      create policy network_features_admin_write on public.network_features
      for all
      using (public.is_super_admin())
      with check (public.is_super_admin())
    $policy$;
  end if;
end $$;
