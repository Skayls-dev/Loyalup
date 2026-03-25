-- Insert Afrocare.be sponsored ad into scan_screen_ads
insert into public.scan_screen_ads (
  advertiser_name,
  title,
  body,
  cta_label,
  cta_url,
  media_type,
  media_url,
  poster_url,
  active,
  display_order,
  starts_at,
  ends_at
)
select *
from (
  values
    (
      'Afrocare',
      'Afrocare, votre plateforme de soins afro & textures bouclees',
      'Découvrez des conseils experts, routines ciblées et produits adaptés pour cheveux texturés.',
      'Visiter afrocare.be',
      'https://afrocare.be/',
      'video'::text,
      '/ads/Afrocare.mp4',
      '/ads/demo-poster.webp',
      true,
      0,
      null::timestamptz,
      null::timestamptz
    )
) as seed_rows(advertiser_name, title, body, cta_label, cta_url, media_type, media_url, poster_url, active, display_order, starts_at, ends_at)
where not exists (
  select 1
  from public.scan_screen_ads ads
  where ads.cta_url = 'https://afrocare.be/'
);
