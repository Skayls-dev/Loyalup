import { createClient } from 'npm:@supabase/supabase-js@2'

const SUMUP_TOKEN_URL = 'https://api.sumup.com/token'

// ── Error type ────────────────────────────────────────────────────────────────

export class SumUpTokenError extends Error {
  constructor(
    message: string,
    public readonly code: 'revoked' | 'no_integration' | 'refresh_failed' | 'env_missing',
  ) {
    super(message)
    this.name = 'SumUpTokenError'
  }
}

// ── Internal: check if token needs refresh (expires within 5 min) ──────────

export function isTokenStale(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now() + 5 * 60 * 1000
}

// ── getValidSumUpToken ─────────────────────────────────────────────────────
// Reads the current token from DB, refreshes if needed, returns access_token.
// Intended for use inside Edge Functions that already have access to the
// service-role admin client.

export async function getValidSumUpToken(
  admin: ReturnType<typeof createClient>,
  fournisseurId: string,
): Promise<string> {
  // 1. Read current integration row
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
    throw new SumUpTokenError(
      `No SumUp integration found for fournisseur ${fournisseurId}`,
      'no_integration',
    )
  }

  if (row.status === 'revoked') {
    throw new SumUpTokenError('SumUp integration has been revoked', 'revoked')
  }

  // 2. Return early if token is still fresh
  if (!isTokenStale(row.expires_at)) {
    return row.access_token
  }

  if (!row.refresh_token) {
    throw new SumUpTokenError('Token expired and no refresh_token available', 'refresh_failed')
  }

  // 3. Perform the refresh
  const clientId = Deno.env.get('SUMUP_CLIENT_ID')
  const clientSecret = Deno.env.get('SUMUP_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new SumUpTokenError('Missing SUMUP_CLIENT_ID or SUMUP_CLIENT_SECRET env vars', 'env_missing')
  }

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
    // Mark as revoked in DB so future calls fail fast
    await admin
      .from('provider_integrations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('fournisseur_id', fournisseurId)
      .eq('provider', 'sumup')

    throw new SumUpTokenError('SumUp refresh_token rejected — integration revoked', 'revoked')
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    expires_in?: number
  }

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString()

  await admin
    .from('provider_integrations')
    .update({
      access_token: tokenData.access_token,
      expires_at: newExpiresAt,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('fournisseur_id', fournisseurId)
    .eq('provider', 'sumup')

  return tokenData.access_token
}
