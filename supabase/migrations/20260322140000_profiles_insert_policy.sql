-- Allow authenticated users to insert their own profile row.
-- Required for the social login completion flow: when a new Google/Apple user
-- has no row in profiles yet, completeSocialProfile() calls upsert() which
-- needs INSERT permission (the existing "update own profile" policy only
-- covers the UPDATE path of an upsert, not the INSERT path).

drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());
