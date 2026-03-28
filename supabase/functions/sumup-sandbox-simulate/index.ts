import { createClient } from 'npm:@supabase/supabase-js@2'
import { getValidSumUpToken, SumUpTokenError } from '../_shared/sumupToken.ts'

const SUMUP_API_BASE = 'https://api.sumup.com'

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

async function sumupFetch({
  path,
  token,
  method = 'GET',
  body,
}: {
  path: string
  token: string
  method?: string
  body?: Record<string, unknown>
}) {
  const response = await fetch(`${SUMUP_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${JSON.stringify(payload)}`)
  }

  return payload
}

function buildProcessPayload() {
  const now = new Date()
  const expiryYear = String(now.getUTCFullYear() + 2)
  const expiryMonth = String(now.getUTCMonth() + 1).padStart(2, '0')

  return {
    payment_type: 'card',
    installments: 1,
    mandate: {
      type: 'recurrent',
      user_agent: 'LooyaalSandboxUI/1.0',
      user_ip: '127.0.0.1',
    },
    card: {
      type: 'VISA',
      name: 'Sandbox Shopper',
      number: '4200000000000042',
      expiry_year: expiryYear,
      expiry_month: expiryMonth,
      cvv: '123',
      zip_code: '75001',
    },
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForFinalCheckoutStatus({
  checkoutId,
  token,
  timeoutMs = 30_000,
  intervalMs = 2_000,
}: {
  checkoutId: string
  token: string
  timeoutMs?: number
  intervalMs?: number
}) {
  const deadline = Date.now() + timeoutMs
  let latest: Record<string, unknown> | null = null

  while (Date.now() <= deadline) {
    latest = await sumupFetch({ path: `/v0.1/checkouts/${checkoutId}`, token })
    const status = String(latest.status ?? '').toUpperCase()
    if (status && status !== 'PENDING') return latest
    await sleep(intervalMs)
  }

  return latest
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
  const sandboxApiKey = Deno.env.get('SUMUP_SANDBOX_API_KEY')
    ?? Deno.env.get('SUM_UP_API_KEY_TEST')
    ?? Deno.env.get('SUM_UP_API_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server misconfiguration' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  const userToken = authHeader?.replace(/^Bearer\s+/i, '')
  if (!userToken) return json({ error: 'Missing Authorization header' }, 401)

  const authClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await authClient.auth.getUser(userToken)
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: fournisseur } = await admin
    .from('fournisseurs')
    .select('id, nom_commerce')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; nom_commerce?: string | null }>()

  if (!fournisseur?.id) {
    return json({ error: 'No merchant account found' }, 404)
  }

  let body: {
    amount?: number
    currency?: string
    merchant_code?: string
    history_limit?: number
    history_only?: boolean
    environment?: 'sandbox' | 'production'
    confirm_production?: boolean
  }

  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const { data: integration } = await admin
    .from('provider_integrations')
    .select('sumup_merchant_code, scopes')
    .eq('fournisseur_id', fournisseur.id)
    .eq('provider', 'sumup')
    .maybeSingle<{ sumup_merchant_code: string | null; scopes?: string[] | null }>()

  const amount = Number(body.amount ?? 12.34)
  const currency = String(body.currency ?? 'EUR').toUpperCase()
  const historyLimit = Number(body.history_limit ?? 10)
  const historyOnly = Boolean(body.history_only)
  const environment = body.environment === 'production' ? 'production' : 'sandbox'
  const isProduction = environment === 'production'
  const confirmProduction = Boolean(body.confirm_production)
  const merchantCode = body.merchant_code ?? integration?.sumup_merchant_code

  if (!historyOnly && !merchantCode) {
    return json({ error: 'Missing merchant_code (connect SumUp first or provide merchant_code)' }, 400)
  }

  if (!historyOnly && (!Number.isFinite(amount) || amount <= 0)) {
    return json({ error: 'amount must be a positive number' }, 400)
  }

  if (isProduction && !historyOnly && !confirmProduction) {
    return json(
      {
        error: 'Production checkout simulation requires explicit confirmation',
        reason: 'production_confirmation_required',
      },
      400,
    )
  }

  let tokenSource: 'sandbox_api_key' | 'oauth' = 'oauth'
  let sumupToken: string | undefined

  if (!isProduction && sandboxApiKey) {
    sumupToken = sandboxApiKey
    tokenSource = 'sandbox_api_key'
  } else {
    const hasPaymentsScope = Array.isArray(integration?.scopes) && integration.scopes.includes('payments')
    if (!historyOnly && !hasPaymentsScope) {
      return json(
        {
          error: isProduction
            ? 'Production checkout simulation requires OAuth scope payments on the connected SumUp account'
            : 'Sandbox checkout simulation requires SUMUP_SANDBOX_API_KEY secret or OAuth scope payments',
          reason: 'missing_payments_scope',
        },
        400,
      )
    }

    try {
      sumupToken = await getValidSumUpToken(admin, fournisseur.id)
    } catch (error) {
      if (error instanceof SumUpTokenError) {
        if (error.code === 'no_integration') {
          return json(
            {
              error: isProduction
                ? 'No SumUp integration found for this merchant. Connect SumUp first to use production mode.'
                : 'No SumUp integration found for this merchant. Connect SumUp first, or set SUMUP_SANDBOX_API_KEY in Supabase secrets.',
              reason: 'no_integration',
            },
            400,
          )
        }
        return json({ error: error.message, reason: error.code }, 400)
      }
      return json({ error: 'Unable to obtain SumUp token' }, 500)
    }
  }

  if (!sumupToken) {
    return json({ error: 'Unable to resolve SumUp token' }, 500)
  }

  try {
    if (historyOnly) {
      const history = await sumupFetch({
        path: `/v0.1/me/transactions/history?order=descending&limit=${encodeURIComponent(String(historyLimit))}`,
        token: sumupToken,
      })

      return json({
        mode: 'history_only',
        environment,
        token_source: tokenSource,
        merchant_code: merchantCode,
        history_items: Array.isArray(history.items) ? history.items.length : 0,
        history,
      })
    }

    const checkoutReference = `looyaal-sandbox-ui-${Date.now()}`
    const checkout = await sumupFetch({
      path: '/v0.1/checkouts',
      method: 'POST',
      token: sumupToken,
      body: {
        checkout_reference: checkoutReference,
        amount,
        currency,
        merchant_code: merchantCode,
        description: `Looyaal sandbox simulation (${fournisseur.nom_commerce ?? 'merchant'})`,
      },
    })

    const checkoutId = String(checkout.id ?? '')
    if (!checkoutId) {
      return json({ error: 'Checkout created but id is missing', checkout }, 500)
    }

    const processed = await sumupFetch({
      path: `/v0.1/checkouts/${checkoutId}`,
      method: 'PUT',
      token: sumupToken,
      body: buildProcessPayload(),
    })

    const checkoutAfter = await waitForFinalCheckoutStatus({ checkoutId, token: sumupToken })

    const history = await sumupFetch({
      path: `/v0.1/me/transactions/history?order=descending&limit=${encodeURIComponent(String(historyLimit))}`,
      token: sumupToken,
    })

    const txCode = String(processed.transaction_code ?? checkoutAfter?.transaction_code ?? '') || null
    const txId = String(processed.transaction_id ?? checkoutAfter?.transaction_id ?? '') || null
    const items = Array.isArray(history.items) ? history.items as Array<Record<string, unknown>> : []

    const matched = items.find((item) => item.transaction_code === txCode || item.id === txId) ?? null

    return json({
      mode: 'simulate',
      environment,
      token_source: tokenSource,
      merchant_code: merchantCode,
      checkout_id: checkoutId,
      checkout_reference: checkoutReference,
      checkout_status: checkoutAfter?.status ?? processed.status ?? checkout.status ?? null,
      transaction_code: txCode,
      transaction_id: txId,
      found_in_history: Boolean(matched),
      matched_history_item: matched,
      next_step: checkoutAfter?.next_step ?? processed.next_step ?? null,
      history_items: items.length,
      history,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ error: 'SumUp sandbox simulation failed', message }, 400)
  }
})
