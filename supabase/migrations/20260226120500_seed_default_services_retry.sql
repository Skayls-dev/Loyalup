do $$
declare
  target_fournisseur_id uuid;
begin
  if to_regclass('public.fournisseurs') is null then
    raise notice 'Skipping services seed: public.fournisseurs table does not exist.';
    return;
  end if;

  select f.id
  into target_fournisseur_id
  from public.fournisseurs f
  join auth.users u on u.id = f.user_id
  where u.email = 'provider1@loyalup.test'
  limit 1;

  if target_fournisseur_id is null then
    select id
    into target_fournisseur_id
    from public.fournisseurs
    order by created_at asc
    limit 1;
  end if;

  if target_fournisseur_id is null then
    raise notice 'Skipping services seed: no fournisseur found.';
    return;
  end if;

  insert into public.services (
    fournisseur_id,
    nom,
    emoji,
    prix_defaut,
    points_defaut,
    points_per_euro,
    actif
  )
  values
    (target_fournisseur_id, 'Café', '☕', 2.50, 25, 10, true),
    (target_fournisseur_id, 'Thé', '🍵', 3.00, 30, 10, true),
    (target_fournisseur_id, 'Déjeuner', '🍽', 14.00, 140, 10, true),
    (target_fournisseur_id, 'Formule', '⭐', 22.00, 250, 10, true),
    (target_fournisseur_id, 'Dessert', '🍰', 6.00, 60, 10, true),
    (target_fournisseur_id, 'Personnalisé', '✏️', null, null, 10, true)
  on conflict do nothing;

  raise notice 'Default services seed applied for fournisseur_id=%', target_fournisseur_id;
end $$;
