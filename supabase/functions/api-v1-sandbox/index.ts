import { buildApiError, buildApiResponse, corsHeaders, withApiAuth } from '../_shared/apiAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return withApiAuth(req, '/api/v1/sandbox', async (ctx) => {
    if (ctx.environment !== 'sandbox') {
      return buildApiError(
        'production_key_not_allowed',
        'Production API keys cannot be used with /api-v1-sandbox',
        403,
        ctx.request_id,
      )
    }

    if (req.method !== 'GET') {
      return buildApiError('not_implemented', 'Unsupported method', 405, ctx.request_id)
    }

    const url = new URL(req.url)
    const mode = (url.searchParams.get('mode') ?? 'status').toLowerCase()

    if (mode === 'status') {
      return buildApiResponse(
        {
          sandbox: true,
          provider_id: ctx.fournisseur_id,
          key_id: ctx.api_key_id,
          scopes: ctx.scopes,
          timestamp: new Date().toISOString(),
        },
        { request_id: ctx.request_id, rate_limit_remaining: ctx.rate_limit_remaining },
      )
    }

    if (mode === 'echo') {
      const payload = {
        query: Object.fromEntries(url.searchParams.entries()),
        path: '/api/v1/sandbox',
      }
      return buildApiResponse(payload, {
        request_id: ctx.request_id,
        rate_limit_remaining: ctx.rate_limit_remaining,
      })
    }

    return buildApiError('invalid_mode', 'mode must be one of status|echo', 400, ctx.request_id)
  })
})
