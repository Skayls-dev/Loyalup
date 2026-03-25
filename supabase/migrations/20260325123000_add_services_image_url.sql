alter table if exists public.services
  add column if not exists image_url text null;
