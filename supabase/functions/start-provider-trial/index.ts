import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Missing env vars' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : ''
  const tokenFromBody = typeof body.access_token === 'string' ? body.access_token.trim() : ''
  const token = tokenFromHeader || tokenFromBody

  if (!token) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const authClient = createClient(supabaseUrl, anonKey)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: userResult, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userResult.user?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const userId = userResult.user.id

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<{ role: 'client' | 'fournisseur' | 'admin' }>()

  if (profileError || profile?.role !== 'fournisseur') {
    return json({ error: 'Forbidden' }, 403)
  }

  const { data: provider, error: providerError } = await admin
    .from('fournisseurs')
    .select('id, tier, tier_expires_at')
    .eq('user_id', userId)
    .maybeSingle<{ id: string; tier: string; tier_expires_at: string | null }>()

  if (providerError || !provider) {
    return json({ error: 'Provider not found' }, 404)
  }

  if (provider.tier !== 'free') {
    return json({ error: 'Trial unavailable for current plan' }, 409)
  }

  if (provider.tier_expires_at) {
    return json({ error: 'Trial already used' }, 409)
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { error: updateError } = await admin
    .from('fournisseurs')
    .update({ tier: 'premium', tier_expires_at: trialEndsAt })
    .eq('id', provider.id)

  if (updateError) {
    return json({ error: updateError.message }, 500)
  }

  return json({
    success: true,
    tier: 'premium',
    tier_expires_at: trialEndsAt,
  })
})
