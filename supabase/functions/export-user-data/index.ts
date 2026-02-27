import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPORT_BUCKET = 'exports'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt)

  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userId = userData.user.id
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const [profileResult, consentsResult, cardsResult, rewardsResult, eventsResult] = await Promise.all([
    adminClient.from('profiles').select('id, nom, email, created_at').eq('id', userId).maybeSingle(),
    adminClient
      .from('user_consents')
      .select('consent_type, granted, policy_version, granted_at, revoked_at')
      .eq('user_id', userId)
      .order('granted_at', { ascending: false }),
    adminClient
      .from('client_points')
      .select('fournisseur_id, solde, total_visites, fournisseurs(nom_commerce)')
      .eq('client_id', userId),
    adminClient
      .from('client_rewards')
      .select('status, unlocked_at, used_at, reward_rule:reward_rules(nom, points_required)')
      .eq('client_id', userId)
      .order('unlocked_at', { ascending: false }),
    adminClient
      .from('user_events')
      .select('created_at, event_type', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ])

  const profileData = profileResult.data
  const consentData = consentsResult.data ?? []
  const cardData = cardsResult.data ?? []
  const rewardData = rewardsResult.data ?? []
  const eventRows = eventsResult.data ?? []

  const loyaltyCards = await Promise.all(
    cardData.map(async (card) => {
      const { data: transactions } = await adminClient
        .from('transactions')
        .select('id, montant, points_credited, status, created_at')
        .eq('client_id', userId)
        .eq('fournisseur_id', card.fournisseur_id)
        .order('created_at', { ascending: false })

      const providerName = Array.isArray(card.fournisseurs)
        ? card.fournisseurs[0]?.nom_commerce
        : card.fournisseurs?.nom_commerce

      return {
        provider_name: providerName ?? 'Commerce',
        points: Number(card.solde ?? 0),
        total_visits: Number(card.total_visites ?? 0),
        transactions: transactions ?? [],
      }
    }),
  )

  const payload = {
    profile: {
      name: profileData?.nom ?? '',
      email: profileData?.email ?? userData.user.email ?? '',
      created_at: profileData?.created_at ?? userData.user.created_at,
      language: 'fr',
    },
    consents: consentData,
    loyalty_cards: loyaltyCards,
    rewards: rewardData,
    promotions_received: [],
    events_summary: {
      total_events: eventsResult.count ?? 0,
      first_event: eventRows[0]?.created_at ?? null,
      last_event: eventRows[eventRows.length - 1]?.created_at ?? null,
    },
  }

  const bucketsResult = await adminClient.storage.listBuckets()
  const hasExportBucket = Boolean(bucketsResult.data?.some((bucket) => bucket.name === EXPORT_BUCKET))

  if (!hasExportBucket) {
    await adminClient.storage.createBucket(EXPORT_BUCKET, { public: false })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const path = `${userId}/export-${now.toISOString().replace(/[:.]/g, '-')}.json`

  const uploadResult = await adminClient.storage
    .from(EXPORT_BUCKET)
    .upload(path, JSON.stringify(payload, null, 2), {
      contentType: 'application/json',
      upsert: false,
    })

  if (uploadResult.error) {
    return new Response(JSON.stringify({ error: uploadResult.error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const signedResult = await adminClient.storage.from(EXPORT_BUCKET).createSignedUrl(path, 48 * 60 * 60)
  if (signedResult.error || !signedResult.data?.signedUrl) {
    return new Response(JSON.stringify({ error: signedResult.error?.message ?? 'Unable to create signed URL' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await adminClient.from('export_requests').insert({
    user_id: userId,
    status: 'completed',
    download_url: signedResult.data.signedUrl,
    requested_at: now.toISOString(),
    completed_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  })

  await adminClient.from('notifications').insert({
    user_id: userId,
    title: 'Vos données sont prêtes',
    body: 'Votre export RGPD est disponible pendant 48h.',
    type: 'data_export_ready',
    created_at: now.toISOString(),
  })

  return new Response(
    JSON.stringify({
      download_url: signedResult.data.signedUrl,
      expires_at: expiresAt.toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
