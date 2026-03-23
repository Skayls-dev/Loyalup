-- Allow authenticated fournisseurs to read client_rewards for their own store.
-- This is required for the RedemptionPanel in the provider dashboard, which queries
-- client_rewards using the provider's auth session (not the client's).

drop policy if exists "Fournisseurs can read client_rewards for their store" on public.client_rewards;

create policy "Fournisseurs can read client_rewards for their store"
  on public.client_rewards
  for select
  to authenticated
  using (
    fournisseur_id in (
      select id
      from public.fournisseurs
      where user_id = auth.uid()
    )
  );
