import { createClient } from 'npm:@supabase/supabase-js@2'

const SUMUP_TOKEN_URL = 'https://api.sumup.com/token'
const SUMUP_MERCHANT_URL = 'https://api.sumup.com/v0.1/me/merchant'
const REDIRECT_BASE = 'https://looyaal.com/merchant/settings'

function redirect(params: Record<string, string>) {
  const url = new URL(REDIRECT_BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return Response.redirect(url.toString(), 302)
}

Deno.serve(async (req: Request) => {
  // Only GET is accepted for OAuth callbacks
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const clientId = Deno.env.get('SUMUP_CLIENT_ID')
  const clientSecret = Deno.env.get('SUMUP_CLIENT_SECRET')
  const redirectUri = Deno.env.get('SUMUP_REDIRECT_URI')

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret || !redirectUri) {
    return redirect({ sumup: 'error', reason: 'server_misconfiguration' })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return redirect({ sumup: 'error', reason: 'missing_params' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // ── 1. Validate CSRF state ───────────────────────────────────────────────
  const { data: stateRow, error: stateError } = await admin
    .from('oauth_states')
    .select('fournisseur_id, expires_at')
    .eq('state', state)
    .eq('provider', 'sumup')
    .maybeSingle<{ fournisseur_id: string; expires_at: string }>()

  if (stateError || !stateRow) {
    return redirect({ sumup: 'error', reason: 'invalid_state' })
  }

  if (new Date(stateRow.expires_at) < new Date()) {
    await admin.from('oauth_states').delete().eq('state', state)
    return redirect({ sumup: 'error', reason: 'state_expired' })
  }

  const fournisseurId = stateRow.fournisseur_id

  // ── 2. Exchange code for tokens ──────────────────────────────────────────
  const tokenRes = await fetch(SUMUP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '')
    console.error('SumUp token exchange failed:', tokenRes.status, body)
    return redirect({ sumup: 'error', reason: 'token_exchange_failed' })
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type: string
    scope?: string
  }

  const { access_token, refresh_token, expires_in, scope } = tokenData

  if (!access_token) {
    return redirect({ sumup: 'error', reason: 'no_access_token' })
  }

  const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

  // ── 3. Fetch merchant profile ────────────────────────────────────────────
  // SumUp already provides merchant_code as a query param in the callback URL.
  // We capture it here so no extra API call (which would require user.profile_readonly) is needed.
  let sumupMerchantCode: string | null = url.searchParams.get('merchant_code') ?? null
  let sumupMerchantName: string | null = null

  // If we ever get the user.profile_readonly scope approved, this will also fill merchant_name.
  const merchantRes = await fetch(SUMUP_MERCHANT_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (merchantRes.ok) {
    const merchantData = await merchantRes.json() as {
      merchant_code?: string
      business_name?: string
      company_name?: string
    }

    // Use API data as source of truth, URL param as fallback
    sumupMerchantCode = merchantData.merchant_code ?? sumupMerchantCode
    sumupMerchantName = merchantData.business_name ?? merchantData.company_name ?? null
  } else {
    console.warn('SumUp merchant fetch skipped:', merchantRes.status)
  }

  const grantedScopes = scope
    ?.split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean) ?? null

  // Guardrail: prevent linking a sandbox merchant account as production OAuth integration.
  // We treat a match with the configured sandbox merchant code as a strong signal.
  const { data: existingIntegration } = await admin
    .from('provider_integrations')
    .select('sumup_sandbox_merchant_code')
    .eq('fournisseur_id', fournisseurId)
    .eq('provider', 'sumup')
    .maybeSingle<{ sumup_sandbox_merchant_code?: string | null }>()

  const sandboxMerchantCode = existingIntegration?.sumup_sandbox_merchant_code?.trim() ?? null
  if (sandboxMerchantCode && sumupMerchantCode && sandboxMerchantCode === sumupMerchantCode) {
    await admin.from('oauth_states').delete().eq('state', state)
    return redirect({ sumup: 'error', reason: 'sandbox_account_detected' })
  }

  // ── 4. Upsert provider_integrations ─────────────────────────────────────
  const { error: upsertError } = await admin
    .from('provider_integrations')
    .upsert(
      {
        fournisseur_id: fournisseurId,
        provider: 'sumup',
        status: 'active',
        access_token,
        refresh_token: refresh_token ?? null,
        expires_at: expiresAt,
        sumup_merchant_code: sumupMerchantCode,
        sumup_merchant_name: sumupMerchantName,
        scopes: grantedScopes,
      },
      { onConflict: 'fournisseur_id,provider' },
    )

  if (upsertError) {
    console.error('Upsert provider_integrations failed:', upsertError.message)
    return redirect({ sumup: 'error', reason: 'db_upsert_failed' })
  }

  // ── 5. Clean up consumed state ───────────────────────────────────────────
  await admin.from('oauth_states').delete().eq('state', state)

  // ── 6. Redirect to success ───────────────────────────────────────────────
  return redirect({ sumup: 'connected' })
})
