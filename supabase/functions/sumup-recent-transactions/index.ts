import { createClient } from 'npm:@supabase/supabase-js@2'
import { getValidSumUpToken, SumUpTokenError } from '../_shared/sumupToken.ts'

const SUMUP_API_BASE = 'https://api.sumup.com'
const LOOKBACK_MINUTES = 30
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SumUpHistoryItem = {
  id?: string
  transaction_code?: string
  timestamp?: string
  amount?: number
  currency?: string
  status?: string
  payment_type?: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function parseTimestamp(value?: string): number | null {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const normalized: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (!trimmed) continue
    normalized.push(trimmed)
  }
  return normalized
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

  let body: { limit?: number; access_token?: string; pending_transaction_id?: string }

  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const authHeader = req.headers.get('Authorization')
    ?? req.headers.get('authorization')
  const userToken = authHeader?.replace(/^Bearer\s+/i, '')
    ?? body.access_token

  let fournisseur: { id: string } | null = null

  // Try to resolve merchant from JWT user
  if (userToken) {
    const authClient = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: authError } = await authClient.auth.getUser(userToken)
    if (!authError && user) {
      const { data } = await admin
        .from('fournisseurs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle<{ id: string }>()
      fournisseur = data ?? null
    }
  }

  // Fallback: resolve merchant from pending_transaction_id (service role, no user auth needed)
  if (!fournisseur?.id && body.pending_transaction_id) {
    const { data } = await admin
      .from('pending_transactions')
      .select('fournisseur_id')
      .eq('id', body.pending_transaction_id)
      .maybeSingle<{ fournisseur_id: string }>()
    if (data?.fournisseur_id) {
      fournisseur = { id: data.fournisseur_id }
    }
  }

  if (!fournisseur?.id) {
    return json({ connected: false, reason: 'no_merchant_account', items: [] })
  }

  const requestedLimit = Number(body.limit ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(requestedLimit)))
    : DEFAULT_LIMIT

  const { data: integration } = await admin
    .from('provider_integrations')
    .select('status')
    .eq('fournisseur_id', fournisseur.id)
    .eq('provider', 'sumup')
    .maybeSingle<{ status?: string | null }>()

  if (!integration || integration.status !== 'active') {
    return json({ connected: false, reason: 'not_connected', items: [] })
  }

  let accessToken: string
  try {
    accessToken = await getValidSumUpToken(admin, fournisseur.id)
  } catch (error) {
    if (error instanceof SumUpTokenError) {
      if (error.code === 'no_integration') {
        return json({ connected: false, reason: 'not_connected', items: [] })
      }

      return json({ connected: false, reason: error.code, items: [] })
    }

    return json({ connected: false, reason: 'token_error', items: [] })
  }

  const now = Date.now()
  const earliest = now - LOOKBACK_MINUTES * 60 * 1000

  try {
    const response = await fetch(
      `${SUMUP_API_BASE}/v0.1/me/transactions/history?order=descending&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

    if (!response.ok) {
      const payload = await response.text().catch(() => '')
      return json({ connected: false, reason: 'sumup_history_error', detail: payload, items: [] }, 400)
    }

    const payload = await response.json() as { items?: SumUpHistoryItem[] }
    const itemsRaw = (payload.items ?? [])
      .filter((item) => String(item.status ?? '').toUpperCase() === 'SUCCESSFUL')
      .filter((item) => {
        const ts = parseTimestamp(item.timestamp)
        return ts !== null && ts >= earliest
      })
      .map((item) => ({
        id: item.id ?? null,
        transaction_code: item.transaction_code ?? null,
        timestamp: item.timestamp ?? null,
        amount: typeof item.amount === 'number' ? item.amount : null,
        currency: item.currency ?? null,
        status: item.status ?? null,
        payment_type: item.payment_type ?? null,
      }))

    const lookbackForUsed = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: usedLinks } = await admin
      .from('transactions')
      .select('sumup_transaction_ids, sumup_transaction_codes, created_at')
      .eq('fournisseur_id', fournisseur.id)
      .eq('status', 'validated')
      .gte('created_at', lookbackForUsed)

    const usedIds = new Set<string>()
    const usedCodes = new Set<string>()
    for (const row of (usedLinks ?? []) as Array<{
      sumup_transaction_ids?: unknown
      sumup_transaction_codes?: unknown
    }>) {
      for (const id of normalizeTextArray(row.sumup_transaction_ids)) {
        usedIds.add(id)
      }
      for (const code of normalizeTextArray(row.sumup_transaction_codes)) {
        usedCodes.add(code)
      }
    }

    const items = itemsRaw.filter((item) => {
      const id = typeof item.id === 'string' ? item.id.trim() : ''
      const code = typeof item.transaction_code === 'string' ? item.transaction_code.trim() : ''
      if (id && usedIds.has(id)) return false
      if (code && usedCodes.has(code)) return false
      return true
    })

    const recommended = items.find((item) => typeof item.amount === 'number' && item.amount > 0) ?? null

    return json({
      connected: true,
      reason: null,
      lookback_minutes: LOOKBACK_MINUTES,
      applied_limit: limit,
      items,
      recommended,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ connected: false, reason: 'network_error', detail: message, items: [] }, 400)
  }
})