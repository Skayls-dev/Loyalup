-- Ads media bucket for images/videos used in QR ad rotation
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ads-media',
  'ads-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read ads media" on storage.objects;
drop policy if exists "Authenticated upload ads media" on storage.objects;
drop policy if exists "Authenticated update ads media" on storage.objects;
drop policy if exists "Authenticated delete ads media" on storage.objects;

create policy "Public read ads media"
on storage.objects
for select
to public
using (bucket_id = 'ads-media');

create policy "Authenticated upload ads media"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'ads-media');

create policy "Authenticated update ads media"
on storage.objects
for update
to authenticated
using (bucket_id = 'ads-media')
with check (bucket_id = 'ads-media');

create policy "Authenticated delete ads media"
on storage.objects
for delete
to authenticated
using (bucket_id = 'ads-media');
