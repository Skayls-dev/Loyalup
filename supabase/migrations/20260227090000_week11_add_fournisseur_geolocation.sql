alter table public.fournisseurs
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fournisseurs_latitude_range_check'
      and conrelid = 'public.fournisseurs'::regclass
  ) then
    alter table public.fournisseurs
      add constraint fournisseurs_latitude_range_check
      check (latitude is null or (latitude >= -90 and latitude <= 90));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fournisseurs_longitude_range_check'
      and conrelid = 'public.fournisseurs'::regclass
  ) then
    alter table public.fournisseurs
      add constraint fournisseurs_longitude_range_check
      check (longitude is null or (longitude >= -180 and longitude <= 180));
  end if;
end $$;

create index if not exists idx_fournisseurs_geo_coords
  on public.fournisseurs (latitude, longitude);