-- Institution role and access management
-- Adds support for institution (ambassador, NGO, municipality) accounts
-- Each institution links to exactly one network and gets read-only analytics

-- Create institution_network_access table
CREATE TABLE IF NOT EXISTS public.institution_network_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  network_id uuid NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, network_id)
);

-- Enable RLS
ALTER TABLE public.institution_network_access ENABLE ROW LEVEL SECURITY;

-- Policy: Institutions read only their own access
DROP POLICY IF EXISTS "Institutions read own access" ON public.institution_network_access;
CREATE POLICY "Institutions read own access"
  ON public.institution_network_access FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Policy: Admins can manage all institution access
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

-- Aggregated view for client growth by day per network
-- Used by institutions to see enrollment trends (no individual client data)
DROP VIEW IF EXISTS public.institution_network_summary CASCADE;
CREATE VIEW public.institution_network_summary AS
SELECT
  nc.network_id,
  date_trunc('day', nc.joined_at) AS joined_day,
  count(*) AS new_clients
FROM public.network_clients nc
GROUP BY nc.network_id, date_trunc('day', nc.joined_at);

-- Aggregated view for merchant performance summary per network
-- No individual client_id or email, purely aggregate metrics by merchant
DROP VIEW IF EXISTS public.institution_merchant_summary CASCADE;
CREATE VIEW public.institution_merchant_summary AS
SELECT
  nm.network_id,
  f.id AS fournisseur_id,
  f.nom_commerce,
  f.city,
  f.country,
  count(DISTINCT npe.client_id) AS unique_clients,
  COALESCE(sum(npe.bonus_points), 0) AS total_bonus_points,
  count(DISTINCT npe.id) AS transaction_count
FROM public.network_members nm
JOIN public.fournisseurs f ON f.id = nm.fournisseur_id
LEFT JOIN public.network_point_events npe 
  ON npe.fournisseur_id = nm.fournisseur_id
  AND npe.network_id = nm.network_id
WHERE nm.status = 'active'
GROUP BY nm.network_id, f.id, f.nom_commerce, f.city, f.country;

-- Grant view access to authenticated users (RLS will be applied per institution)
GRANT SELECT ON public.institution_network_summary TO authenticated;
GRANT SELECT ON public.institution_merchant_summary TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE public.institution_network_access IS 'Maps institutions to networks they sponsor. Each institution links to exactly one network.';
COMMENT ON VIEW public.institution_network_summary IS 'Daily client enrollment count per network - anonymized, no individual client data';
COMMENT ON VIEW public.institution_merchant_summary IS 'Aggregated merchant performance metrics per network - anonymized, no individual client data';
