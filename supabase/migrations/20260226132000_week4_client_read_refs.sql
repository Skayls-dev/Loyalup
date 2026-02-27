-- Allow clients to read provider metadata used by loyalty cards/history.
drop policy if exists "Authenticated users can read fournisseurs" on public.fournisseurs;
create policy "Authenticated users can read fournisseurs"
  on public.fournisseurs
  for select
  to authenticated
  using (true);

-- Allow clients to read services from providers they have interacted with.
drop policy if exists "Clients can read related services" on public.services;
create policy "Clients can read related services"
  on public.services
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_points cp
      where cp.client_id = auth.uid()
        and cp.fournisseur_id = services.fournisseur_id
    )
    or exists (
      select 1
      from public.transactions t
      where t.client_id = auth.uid()
        and t.fournisseur_id = services.fournisseur_id
    )
  );
