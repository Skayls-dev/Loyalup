import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildApiError, buildApiResponse, checkScope, corsHeaders, withApiAuth } from '../_shared/apiAuth.ts'
import { dispatchWebhookEvent } from '../_shared/webhookDispatch.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return withApiAuth(req, '/api/v1/services', async (ctx) => {
    if (ctx.environment !== 'production') {
      return buildApiError(
        'sandbox_key_not_allowed',
        'Sandbox API keys can only be used with /api-v1-sandbox',
        403,
        ctx.request_id,
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return buildApiError('server_config_error', 'Missing Supabase env', 500, ctx.request_id)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const serviceId = url.searchParams.get('id') ?? pathParts[pathParts.length - 1]

    if (req.method === 'GET') {
      const result = await admin
        .from('services')
        .select('id, nom, emoji, prix_defaut, points_defaut, points_per_euro, actif, created_at')
        .eq('fournisseur_id', ctx.fournisseur_id)
        .eq('actif', true)
        .order('created_at', { ascending: false })

      if (result.error) {
        return buildApiError('query_error', result.error.message, 500, ctx.request_id)
      }

      return buildApiResponse(result.data ?? [], {
        request_id: ctx.request_id,
        rate_limit_remaining: ctx.rate_limit_remaining,
      })
    }

    if (req.method === 'POST') {
      checkScope('write', ctx.scopes)

      const body = await req.json().catch(() => null) as null | {
        nom?: string
        emoji?: string
        prix_defaut?: number | null
        points_defaut?: number | null
        points_per_euro?: number
        actif?: boolean
      }

      if (!body?.nom || !body.emoji) {
        return buildApiError('validation_error', 'nom and emoji are required', 400, ctx.request_id)
      }

      const insertResult = await admin
        .from('services')
        .insert({
          fournisseur_id: ctx.fournisseur_id,
          nom: body.nom,
          emoji: body.emoji,
          prix_defaut: body.prix_defaut ?? null,
          points_defaut: body.points_defaut ?? null,
          points_per_euro: body.points_per_euro ?? 10,
          actif: body.actif ?? true,
        })
        .select('id, nom, emoji, prix_defaut, points_defaut, points_per_euro, actif, created_at')
        .single()

      if (insertResult.error || !insertResult.data) {
        return buildApiError('insert_error', insertResult.error?.message ?? 'Unable to create service', 500, ctx.request_id)
      }

      void dispatchWebhookEvent({
        fournisseur_id: ctx.fournisseur_id,
        event_type: 'service.created',
        payload: insertResult.data as Record<string, unknown>,
      })

      return buildApiResponse(insertResult.data, {
        request_id: ctx.request_id,
        rate_limit_remaining: ctx.rate_limit_remaining,
      })
    }

    if (req.method === 'PUT' && serviceId && serviceId !== 'api-v1-services') {
      checkScope('write', ctx.scopes)

      const body = await req.json().catch(() => null) as null | {
        nom?: string
        emoji?: string
        prix_defaut?: number | null
        points_defaut?: number | null
        points_per_euro?: number
        actif?: boolean
      }

      if (!body) {
        return buildApiError('validation_error', 'Invalid body', 400, ctx.request_id)
      }

      const updateResult = await admin
        .from('services')
        .update({
          nom: body.nom,
          emoji: body.emoji,
          prix_defaut: body.prix_defaut,
          points_defaut: body.points_defaut,
          points_per_euro: body.points_per_euro,
          actif: body.actif,
        })
        .eq('id', serviceId)
        .eq('fournisseur_id', ctx.fournisseur_id)
        .select('id, nom, emoji, prix_defaut, points_defaut, points_per_euro, actif, created_at')
        .maybeSingle()

      if (updateResult.error || !updateResult.data) {
        return buildApiError('not_found', 'Service not found', 404, ctx.request_id)
      }

      void dispatchWebhookEvent({
        fournisseur_id: ctx.fournisseur_id,
        event_type: 'service.updated',
        payload: updateResult.data as Record<string, unknown>,
      })

      return buildApiResponse(updateResult.data, {
        request_id: ctx.request_id,
        rate_limit_remaining: ctx.rate_limit_remaining,
      })
    }

    return buildApiError('not_implemented', 'Unsupported route or method', 404, ctx.request_id)
  })
})
