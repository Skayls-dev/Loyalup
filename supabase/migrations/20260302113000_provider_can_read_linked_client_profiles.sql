drop policy if exists "Providers read linked client profiles" on public.profiles;

create policy "Providers read linked client profiles"
  on public.profiles
  for select
  to authenticated
  using (
    role = 'client'
    and (
      exists (
        select 1
        from public.client_points cp
        where cp.client_id = profiles.id
          and cp.fournisseur_id = public.current_provider_id()
      )
      or exists (
        select 1
        from public.transactions t
        where t.client_id = profiles.id
          and t.fournisseur_id = public.current_provider_id()
      )
      or exists (
        select 1
        from public.pending_transactions pt
        where pt.client_id = profiles.id
          and pt.fournisseur_id = public.current_provider_id()
      )
    )
  );