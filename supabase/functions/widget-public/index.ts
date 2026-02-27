import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing env vars' }, 500)
  }

  const url = new URL(req.url)
  const fournisseurId = url.searchParams.get('fournisseur_id')

  if (!fournisseurId) {
    return json({ error: 'Missing fournisseur_id' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const [{ data: fournisseur, error: fournisseurError }, { data: whiteLabel }, { data: promotions, error: promoError }] =
    await Promise.all([
      admin
        .from('fournisseurs')
        .select('id, nom_commerce, tier')
        .eq('id', fournisseurId)
        .maybeSingle<{ id: string; nom_commerce: string; tier: string }>(),
      admin
        .from('white_label_configs')
        .select('brand_name, logo_url, primary_color, secondary_color, accent_color, hide_loyalup_branding')
        .eq('fournisseur_id', fournisseurId)
        .maybeSingle(),
      admin
        .from('promotions')
        .select('id, titre, description, points_requis, actif')
        .eq('fournisseur_id', fournisseurId)
        .eq('actif', true)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  if (fournisseurError || !fournisseur) {
    return json({ error: 'Provider not found' }, 404)
  }

  if (promoError) {
    return json({ error: promoError.message }, 500)
  }

  return json({
    success: true,
    widget: {
      provider: {
        id: fournisseur.id,
        name: whiteLabel?.brand_name ?? fournisseur.nom_commerce,
        tier: fournisseur.tier,
      },
      branding: {
        logo_url: whiteLabel?.logo_url ?? null,
        primary_color: whiteLabel?.primary_color ?? '#18181b',
        secondary_color: whiteLabel?.secondary_color ?? '#3f3f46',
        accent_color: whiteLabel?.accent_color ?? '#fafafa',
        show_loyalup_branding: !Boolean(whiteLabel?.hide_loyalup_branding),
      },
      promotions: promotions ?? [],
    },
  })
})

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
