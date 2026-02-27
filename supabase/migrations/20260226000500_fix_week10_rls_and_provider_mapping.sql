-- Week 10 fix: coalition_members RLS recursion and provider/user mapping

create or replace function public.current_provider_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select f.id
  from public.fournisseurs f
  where f.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_provider_id() from public;
grant execute on function public.current_provider_id() to authenticated;

create or replace function public.provider_belongs_to_coalition(p_coalition_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.coalition_members cm
    where cm.coalition_id = p_coalition_id
      and cm.fournisseur_id = public.current_provider_id()
      and cm.status = 'active'
  );
$$;

revoke all on function public.provider_belongs_to_coalition(uuid) from public;
grant execute on function public.provider_belongs_to_coalition(uuid) to authenticated;

-- provider_coalitions policy: created_by references fournisseurs.id, not auth uid directly
DROP POLICY IF EXISTS "Providers manage coalitions" ON provider_coalitions;
CREATE POLICY "Providers manage coalitions"
  ON provider_coalitions FOR UPDATE TO authenticated
  USING (created_by = public.current_provider_id())
  WITH CHECK (created_by = public.current_provider_id());

-- coalition_members policies: remove recursive policy and map auth user -> fournisseur id
DROP POLICY IF EXISTS "Providers view coalition members" ON coalition_members;
CREATE POLICY "Providers view coalition members"
  ON coalition_members FOR SELECT TO authenticated
  USING (
    public.provider_belongs_to_coalition(coalition_id)
  );

DROP POLICY IF EXISTS "Providers join existing coalitions" ON coalition_members;
CREATE POLICY "Providers join existing coalitions"
  ON coalition_members FOR INSERT TO authenticated
  WITH CHECK (fournisseur_id = public.current_provider_id());
