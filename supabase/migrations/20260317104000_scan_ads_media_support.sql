alter table public.scan_screen_ads
  add column if not exists media_type text,
  add column if not exists media_url text,
  add column if not exists poster_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scan_screen_ads_media_type_check'
      and conrelid = 'public.scan_screen_ads'::regclass
  ) then
    alter table public.scan_screen_ads
      add constraint scan_screen_ads_media_type_check
      check (media_type is null or media_type in ('image', 'video'));
  end if;
end $$;

update public.scan_screen_ads
set
  media_type = 'image',
  media_url = '/ads/premium-boost.svg'
where title = 'Boostez vos visites avec LoyalUp Premium'
  and (media_url is null or media_url = '');

update public.scan_screen_ads
set
  media_type = 'image',
  media_url = '/ads/flash-campaign.svg'
where title = 'Activez vos campagnes flash du week-end'
  and (media_url is null or media_url = '');

update public.scan_screen_ads
set
  media_type = 'image',
  media_url = '/ads/coalition-network.svg'
where title = 'Fidelisez mieux avec vos reseaux partenaires'
  and (media_url is null or media_url = '');
