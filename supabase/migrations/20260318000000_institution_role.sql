-- Ensure city and country columns exist on fournisseurs
ALTER TABLE public.fournisseurs
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text;

-- Ensure institution_network_access table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.institution_network_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, network_id)
);

ALTER TABLE public.institution_network_access ENABLE ROW LEVEL SECURITY;

-- Une institution lit uniquement sa propre liaison
DROP POLICY IF EXISTS "Institutions read own access" ON public.institution_network_access;
CREATE POLICY "Institutions read own access"
  ON public.institution_network_access FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Seul un admin peut créer des liaisons
DROP POLICY IF EXISTS "Admin manages institution access" ON public.institution_network_access;
CREATE POLICY "Admin manages institution access"
  ON public.institution_network_access FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Vue agrégée anonymisée des membres réseau accessible aux institutions
-- (jamais de données individuelles : pas de client_id, pas d'email)
DROP VIEW IF EXISTS public.institution_network_summary CASCADE;
CREATE VIEW public.institution_network_summary AS
SELECT
  nc.network_id,
  date_trunc('day', nc.joined_at) AS joined_day,
  count(*) AS new_clients
FROM public.network_clients nc
GROUP BY nc.network_id, date_trunc('day', nc.joined_at);

DROP VIEW IF EXISTS public.institution_merchant_summary CASCADE;
CREATE VIEW public.institution_merchant_summary AS
SELECT
  nm.network_id,
  f.nom_commerce,
  f.city,
  f.country,
  count(DISTINCT npe.client_id) AS unique_clients,
  sum(npe.bonus_points) AS total_bonus_points,
  count(npe.id) AS transaction_count
FROM public.network_members nm
JOIN public.fournisseurs f ON f.id = nm.fournisseur_id
LEFT JOIN public.network_point_events npe ON npe.fournisseur_id = nm.fournisseur_id
  AND npe.network_id = nm.network_id
WHERE nm.status = 'active'
GROUP BY nm.network_id, f.id, f.nom_commerce, f.city, f.country;

