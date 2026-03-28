import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Env vars ──────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const clientId = Deno.env.get('SUMUP_CLIENT_ID')
  const redirectUri = Deno.env.get('SUMUP_REDIRECT_URI')
  const scopesEnv = Deno.env.get('SUMUP_OAUTH_SCOPES')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !clientId || !redirectUri) {
    return json({ error: 'Server misconfiguration' }, 500)
  }

  // ── 1. Validate JWT (marchand must be authenticated) ──────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: userResult, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userResult.user?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const userId = userResult.user.id

  // ── 2. Resolve fournisseur_id from user_id ────────────────────────────────
  const { data: fournisseur, error: fournisseurError } = await admin
    .from('fournisseurs')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>()

  if (fournisseurError || !fournisseur?.id) {
    return json({ error: 'Forbidden: not a merchant account' }, 403)
  }

  const fournisseurId = fournisseur.id

  // ── 3. Clean up expired states (best-effort) ──────────────────────────────
  await admin
    .from('oauth_states')
    .delete()
    .lt('expires_at', new Date().toISOString())

  // ── 4. Generate CSRF state and store it ───────────────────────────────────
  const state = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: insertError } = await admin.from('oauth_states').insert({
    state,
    provider: 'sumup',
    fournisseur_id: fournisseurId,
    expires_at: expiresAt,
  })

  if (insertError) {
    console.error('Failed to store oauth state:', insertError.message)
    return json({ error: 'Failed to initiate OAuth flow' }, 500)
  }

  // ── 5. Build SumUp authorization URL ─────────────────────────────────────
  const authorizeUrl = new URL('https://api.sumup.com/authorize')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  // Some SumUp apps are not granted advanced scopes by default.
  // Keep a minimal safe default and allow explicit override via env.
  const scopes = scopesEnv?.trim().length
    ? scopesEnv.trim()
    : 'user.profile_readonly'
  authorizeUrl.searchParams.set('scope', scopes)
  authorizeUrl.searchParams.set('state', state)

  return json({ authorize_url: authorizeUrl.toString() })
})
