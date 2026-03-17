insert into public.scan_screen_ads (
  title,
  body,
  cta_label,
  cta_url,
  active,
  display_order,
  starts_at,
  ends_at
)
select *
from (
  values
    (
      'Boostez vos visites avec LoyalUp Premium',
      'Activez des campagnes intelligentes et transformez chaque passage en retour client mesurable.',
      'Activer Premium',
      'https://loyalup-pink.vercel.app/provider?tab=developers',
      true,
      1,
      null::timestamptz,
      null::timestamptz
    ),
    (
      'Activez vos campagnes flash du week-end',
      'Diffusez une offre limitee, captez les retours rapides et suivez les performances en direct sur votre QR.',
      'Creer une campagne',
      'https://loyalup-pink.vercel.app/provider?tab=promotions',
      true,
      2,
      null::timestamptz,
      null::timestamptz
    ),
    (
      'Fidelisez mieux avec vos reseaux partenaires',
      'Mettez en avant vos avantages coalition et augmentez les visites croisees entre commerces membres.',
      'Voir les reseaux',
      'https://loyalup-pink.vercel.app/provider/network',
      true,
      3,
      null::timestamptz,
      null::timestamptz
    )
) as seed_rows(title, body, cta_label, cta_url, active, display_order, starts_at, ends_at)
where not exists (
  select 1
  from public.scan_screen_ads ads
  where ads.title = seed_rows.title
);
