import { createClient } from 'npm:@supabase/supabase-js@2'
import { isTokenStale, SumUpTokenError } from '../_shared/sumupToken.ts'

const SUMUP_TOKEN_URL = 'https://api.sumup.com/token'

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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const clientId = Deno.env.get('SUMUP_CLIENT_ID')
  const clientSecret = Deno.env.get('SUMUP_CLIENT_SECRET')

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
    return json({ error: 'Server misconfiguration' }, 500)
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { fournisseur_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { fournisseur_id: fournisseurId } = body
  if (!fournisseurId) {
    return json({ error: 'fournisseur_id is required' }, 400)
  }

  // This function is called by service_role only — no JWT validation.
  // Callers must secure access via service_role key in Authorization header.
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // ── 1. Read current integration row ──────────────────────────────────────
  const { data: row, error: readError } = await admin
    .from('provider_integrations')
    .select('access_token, refresh_token, expires_at, status')
    .eq('fournisseur_id', fournisseurId)
    .eq('provider', 'sumup')
    .maybeSingle<{
      access_token: string
      refresh_token: string | null
      expires_at: string
      status: string
    }>()

  if (readError || !row) {
    return json({ error: 'No SumUp integration found for this fournisseur' }, 404)
  }

  if (row.status === 'revoked') {
    return json({ refreshed: false, revoked: true }, 200)
  }

  // ── 2. Check if refresh is needed ────────────────────────────────────────
  if (!isTokenStale(row.expires_at)) {
    return json({ refreshed: false })
  }

  if (!row.refresh_token) {
    return json({ refreshed: false, revoked: false, error: 'no_refresh_token' }, 200)
  }

  // ── 3. Call SumUp token endpoint ─────────────────────────────────────────
  const tokenRes = await fetch(SUMUP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
    }),
  })

  if (!tokenRes.ok) {
    // Refresh token rejected — mark integration as revoked
    await admin
      .from('provider_integrations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('fournisseur_id', fournisseurId)
      .eq('provider', 'sumup')

    console.error('SumUp refresh failed:', tokenRes.status, await tokenRes.text().catch(() => ''))
    return json({ refreshed: false, revoked: true })
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    expires_in?: number
  }

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString()

  // ── 4. Persist new tokens ─────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from('provider_integrations')
    .update({
      access_token: tokenData.access_token,
      expires_at: newExpiresAt,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('fournisseur_id', fournisseurId)
    .eq('provider', 'sumup')

  if (updateError) {
    console.error('Failed to update provider_integrations:', updateError.message)
    return json({ error: 'Failed to persist refreshed token' }, 500)
  }

  return json({ refreshed: true })
})
