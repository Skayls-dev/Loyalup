-- Week 11 fix: public visibility policies should include anon role

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
