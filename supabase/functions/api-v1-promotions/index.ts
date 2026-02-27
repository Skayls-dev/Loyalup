import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildApiError, buildApiResponse, checkScope, corsHeaders, withApiAuth } from '../_shared/apiAuth.ts'
import { dispatchWebhookEvent } from '../_shared/webhookDispatch.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return withApiAuth(req, '/api/v1/promotions', async (ctx) => {
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

    if (req.method === 'GET') {
      const nowIso = new Date().toISOString()

      const result = await admin
        .from('promotions')
        .select('id, titre, description, emoji, type, valeur, date_debut, date_fin, actif, created_at')
        .eq('fournisseur_id', ctx.fournisseur_id)
        .eq('actif', true)
        .lte('date_debut', nowIso)
        .gte('date_fin', nowIso)
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
        titre?: string
        description?: string
        emoji?: string
        type?: 'double_points' | 'discount' | 'free_item' | 'custom'
        valeur?: number
        date_debut?: string
        date_fin?: string
      }

      if (!body?.titre || !body.type || typeof body.valeur !== 'number' || !body.date_debut || !body.date_fin) {
        return buildApiError('validation_error', 'Missing required promotion fields', 400, ctx.request_id)
      }

      const inserted = await admin
        .from('promotions')
        .insert({
          fournisseur_id: ctx.fournisseur_id,
          titre: body.titre,
          description: body.description ?? '',
          emoji: body.emoji ?? '🎉',
          type: body.type,
          valeur: body.valeur,
          date_debut: body.date_debut,
          date_fin: body.date_fin,
          actif: true,
        })
        .select('id, titre, description, emoji, type, valeur, date_debut, date_fin, actif, created_at')
        .single()

      if (inserted.error || !inserted.data) {
        return buildApiError('insert_error', inserted.error?.message ?? 'Unable to create promotion', 500, ctx.request_id)
      }

      void dispatchWebhookEvent({
        fournisseur_id: ctx.fournisseur_id,
        event_type: 'promotion.created',
        payload: inserted.data as Record<string, unknown>,
      })

      return buildApiResponse(inserted.data, {
        request_id: ctx.request_id,
        rate_limit_remaining: ctx.rate_limit_remaining,
      })
    }

    return buildApiError('not_implemented', 'Unsupported route or method', 404, ctx.request_id)
  })
})
