import { createClient } from 'npm:@supabase/supabase-js@2'
import { getValidSumUpToken, SumUpTokenError } from '../_shared/sumupToken.ts'

// Endpoint that requires only `transactions.history` scope (the one we have approved).
// A non-401 response confirms the access_token is alive and accepted by SumUp.
const SUMUP_TX_URL = 'https://api.sumup.com/v0.1/me/transactions/history?limit=1'

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server misconfiguration' }, 500)
  }

  // ── Validate Looyaal JWT ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')

  if (!token) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  const authClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await authClient.auth.getUser(token)

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Resolve fournisseur_id ────────────────────────────────────────────────
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: fournisseur } = await admin
    .from('fournisseurs')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string }>()

  if (!fournisseur?.id) {
    return json({ alive: false, reason: 'no_merchant_account' }, 200)
  }

  // ── Get valid SumUp token (auto-refreshes if stale) ───────────────────────
  let accessToken: string
  try {
    accessToken = await getValidSumUpToken(admin, fournisseur.id)
  } catch (err) {
    if (err instanceof SumUpTokenError) {
      if (err.code === 'no_integration') return json({ alive: false, reason: 'not_connected' })
      if (err.code === 'revoked') return json({ alive: false, reason: 'revoked' })
      if (err.code === 'refresh_failed') return json({ alive: false, reason: 'refresh_failed' })
    }
    return json({ alive: false, reason: 'token_error' })
  }

  // ── Ping SumUp API with the transactions.history scope ───────────────────
  let pingStatus: number
  try {
    const pingRes = await fetch(SUMUP_TX_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    pingStatus = pingRes.status
  } catch {
    // Network failure — cannot confirm
    return json({ alive: false, reason: 'network_error' })
  }

  if (pingStatus === 401 || pingStatus === 403) {
    // Token was accepted by Supabase but rejected by SumUp — integration broken
    await admin
      .from('provider_integrations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('fournisseur_id', fournisseur.id)
      .eq('provider', 'sumup')
    return json({ alive: false, reason: `sumup_${pingStatus}` })
  }

  // Any other status (200, 404, 422…) means the token is accepted by SumUp
  return json({ alive: true })
})
