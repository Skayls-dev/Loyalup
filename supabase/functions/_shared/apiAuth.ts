import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { buildRateLimitHeaders, checkRateLimit, getAdminClientFromEnv } from './rateLimiter.ts'

type ApiKeyRow = {
  id: string
  fournisseur_id: string
  scopes: string[]
  environment: 'sandbox' | 'production'
  expires_at: string | null
  is_active: boolean
  grace_until: string | null
  fournisseurs: { tier: string } | null
}

type ApiAuthContext = {
  api_key_id: string
  fournisseur_id: string
  scopes: string[]
  environment: 'sandbox' | 'production'
  tier: string
  rate_limit_remaining: number
  rate_limit_headers: HeadersInit
  request_id: string
}

type ApiError = {
  success: false
  error: { code: string; message: string }
  meta: { request_id: string; timestamp: string; api_version: 'v1' }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, x-client-info, apikey, content-type',
}

function extractApiKey(req: Request): string | null {
  const direct = req.headers.get('X-API-Key')?.trim()
  if (direct) {
    return direct
  }

  const auth = req.headers.get('Authorization')?.trim() ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return null
  }

  const token = auth.slice(7).trim()
  return token.length > 0 ? token : null
}

function hashApiKey(raw: string, pepper: string): string {
  const hash = createHash('sha256')
  hash.update(`${raw}:${pepper}`)
  return hash.digest('hex')
}

function makeRequestId(): string {
  return crypto.randomUUID()
}

function getRequestSize(req: Request): number {
  const value = req.headers.get('content-length')
  return value ? Number(value) : 0
}

async function lookupApiKey(adminClient: SupabaseClient, keyHash: string): Promise<ApiKeyRow | null> {
  const { data, error } = await adminClient
    .from('api_keys')
    .select('id, fournisseur_id, scopes, environment, expires_at, is_active, grace_until, fournisseurs(tier)')
    .eq('key_hash', keyHash)
    .maybeSingle<ApiKeyRow>()

  if (error) {
    throw error
  }

  return data
}

export function checkScope(requiredScope: string, apiKeyScopes: string[]) {
  if (!apiKeyScopes.includes(requiredScope)) {
    throw new ApiHttpError(403, 'missing_scope', `Missing required scope: ${requiredScope}`)
  }
}

export function buildApiResponse<T>(
  data: T,
  meta: {
    request_id: string
    rate_limit_remaining: number
    extra?: Record<string, unknown>
  },
): Response {
  const payload = {
    success: true,
    data,
    meta: {
      request_id: meta.request_id,
      timestamp: new Date().toISOString(),
      api_version: 'v1' as const,
      rate_limit_remaining: meta.rate_limit_remaining,
      ...(meta.extra ?? {}),
    },
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

export function buildApiError(code: string, message: string, status: number, requestId: string): Response {
  const payload: ApiError = {
    success: false,
    error: { code, message },
    meta: {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      api_version: 'v1',
    },
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

export async function validateApiKey(req: Request): Promise<ApiAuthContext> {
  const requestId = makeRequestId()
  const apiKey = extractApiKey(req)

  if (!apiKey) {
    throw new ApiHttpError(401, 'missing_api_key', 'Missing API key')
  }

  const pepper = Deno.env.get('API_KEY_PEPPER')
  if (!pepper) {
    throw new ApiHttpError(500, 'server_config_error', 'Missing API_KEY_PEPPER')
  }

  const adminClient = getAdminClientFromEnv()

  const row = await lookupApiKey(adminClient, hashApiKey(apiKey, pepper))
  if (!row) {
    throw new ApiHttpError(401, 'invalid_api_key', 'Invalid API key')
  }

  const now = new Date()

  if (!row.is_active) {
    throw new ApiHttpError(401, 'api_key_revoked', 'API key is revoked')
  }

  if (row.expires_at && new Date(row.expires_at).getTime() < now.getTime()) {
    if (!row.grace_until || new Date(row.grace_until).getTime() < now.getTime()) {
      throw new ApiHttpError(401, 'api_key_expired', 'API key is expired')
    }
  }

  const tier = row.fournisseurs?.tier ?? 'free'

  const rate = await checkRateLimit(adminClient, row.id, tier)
  if (rate.limited) {
    throw new ApiHttpError(429, 'rate_limited', 'Rate limit exceeded', {
      retry_after: rate.retry_after,
      headers: buildRateLimitHeaders(rate),
    })
  }

  void adminClient.from('api_keys').update({ last_used_at: now.toISOString() }).eq('id', row.id)

  return {
    api_key_id: row.id,
    fournisseur_id: row.fournisseur_id,
    scopes: row.scopes ?? ['read'],
    environment: row.environment,
    tier,
    rate_limit_remaining: rate.remaining,
    rate_limit_headers: buildRateLimitHeaders(rate),
    request_id: requestId,
  }
}

export async function logApiUsage(params: {
  adminClient?: SupabaseClient
  api_key_id: string
  endpoint: string
  method: string
  status_code: number
  response_time_ms: number
  request_size_bytes: number
  response_size_bytes: number
  ip_address: string | null
}) {
  const adminClient = params.adminClient ?? getAdminClientFromEnv()

  await adminClient.from('api_usage').insert({
    api_key_id: params.api_key_id,
    endpoint: params.endpoint,
    method: params.method,
    status_code: params.status_code,
    response_time_ms: params.response_time_ms,
    request_size_bytes: params.request_size_bytes,
    response_size_bytes: params.response_size_bytes,
    ip_address: params.ip_address,
  })
}

export async function withApiAuth(
  req: Request,
  endpoint: string,
  handler: (ctx: ApiAuthContext) => Promise<Response>,
): Promise<Response> {
  const startedAt = performance.now()
  const requestSize = getRequestSize(req)
  let context: ApiAuthContext | null = null
  let response: Response

  try {
    context = await validateApiKey(req)
    response = await handler(context)
  } catch (error) {
    const requestId = context?.request_id ?? makeRequestId()

    if (error instanceof ApiHttpError) {
      response = buildApiError(error.code, error.message, error.status, requestId)
      const merged = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(error.details?.headers ?? {}),
      }
      response = new Response(await response.text(), { status: error.status, headers: merged })
    } else {
      response = buildApiError('internal_error', 'Unexpected error', 500, requestId)
    }
  }

  const duration = Math.round(performance.now() - startedAt)
  const responseBody = await response.clone().text()

  if (context) {
    const forwardedFor = req.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0]?.trim() ?? null

    void logApiUsage({
      api_key_id: context.api_key_id,
      endpoint,
      method: req.method,
      status_code: response.status,
      response_time_ms: duration,
      request_size_bytes: requestSize,
      response_size_bytes: responseBody.length,
      ip_address: ip,
    })

    const headers = new Headers(response.headers)
    headers.set('X-Request-Id', context.request_id)
    headers.set('X-RateLimit-Remaining', String(context.rate_limit_remaining))

    return new Response(responseBody, {
      status: response.status,
      headers,
    })
  }

  return response
}

export class ApiHttpError extends Error {
  status: number
  code: string
  details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export { corsHeaders }
