import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildApiError, buildApiResponse, checkScope, corsHeaders, withApiAuth } from '../_shared/apiAuth.ts'
import { dispatchWebhookEvent } from '../_shared/webhookDispatch.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return withApiAuth(req, '/api/v1/transactions', async (ctx) => {
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
    const maybeId = url.searchParams.get('id') ?? pathParts[pathParts.length - 1]

    if (req.method === 'GET' && (!maybeId || maybeId === 'api-v1-transactions')) {
      checkScope('read', ctx.scopes)

      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 20)))
      const from = (page - 1) * limit
      const to = from + limit - 1

      let query = admin
        .from('transactions')
        .select('id, client_id, service_id, montant, points_credited, status, created_at', { count: 'exact' })
        .eq('fournisseur_id', ctx.fournisseur_id)
        .order('created_at', { ascending: false })
        .range(from, to)

      const clientId = url.searchParams.get('client_id')
      const serviceId = url.searchParams.get('service_id')
      const dateFrom = url.searchParams.get('date_from')
      const dateTo = url.searchParams.get('date_to')

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      if (serviceId) {
        query = query.eq('service_id', serviceId)
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }

      const result = await query
      if (result.error) {
        return buildApiError('query_error', result.error.message, 500, ctx.request_id)
      }

      return buildApiResponse(
        {
          items: result.data ?? [],
          pagination: { page, limit, total: result.count ?? 0 },
        },
        { request_id: ctx.request_id, rate_limit_remaining: ctx.rate_limit_remaining },
      )
    }

    if (req.method === 'POST') {
      checkScope('transactions', ctx.scopes)

      const body = await req.json().catch(() => null) as null | {
        client_email?: string
        service_id?: string | null
        montant?: number
        description?: string
      }

      if (!body?.client_email || typeof body.montant !== 'number') {
        return buildApiError('validation_error', 'Body must include client_email and montant', 400, ctx.request_id)
      }

      const profile = await admin
        .from('profiles')
        .select('id, email')
        .eq('email', body.client_email.toLowerCase())
        .eq('role', 'client')
        .maybeSingle<{ id: string; email: string }>()

      if (profile.error || !profile.data?.id) {
        return buildApiError('not_found', 'Client not found', 404, ctx.request_id)
      }

      const points = Math.max(0, Math.round(body.montant * 10))

      const qrToken = await admin
        .from('qr_tokens')
        .insert({
          fournisseur_id: ctx.fournisseur_id,
          token: crypto.randomUUID(),
          status: 'used',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single<{ id: string }>()

      if (qrToken.error || !qrToken.data?.id) {
        return buildApiError('insert_error', 'Unable to create synthetic token', 500, ctx.request_id)
      }

      const pending = await admin
        .from('pending_transactions')
        .insert({
          qr_token_id: qrToken.data.id,
          client_id: profile.data.id,
          fournisseur_id: ctx.fournisseur_id,
          status: 'validated',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single<{ id: string }>()

      if (pending.error || !pending.data?.id) {
        return buildApiError('insert_error', 'Unable to create pending transaction', 500, ctx.request_id)
      }

      const transaction = await admin
        .from('transactions')
        .insert({
          pending_transaction_id: pending.data.id,
          client_id: profile.data.id,
          fournisseur_id: ctx.fournisseur_id,
          service_id: body.service_id ?? null,
          montant: body.montant,
          points_credited: points,
          status: 'validated',
        })
        .select('id, points_credited')
        .single<{ id: string; points_credited: number }>()

      if (transaction.error || !transaction.data?.id) {
        return buildApiError('insert_error', transaction.error?.message ?? 'Unable to create transaction', 500, ctx.request_id)
      }

      const pointsRow = await admin
        .from('client_points')
        .select('id, solde, total_visites')
        .eq('client_id', profile.data.id)
        .eq('fournisseur_id', ctx.fournisseur_id)
        .maybeSingle<{ id: string; solde: number; total_visites: number }>()

      const current = Number(pointsRow.data?.solde ?? 0)
      const visits = Number(pointsRow.data?.total_visites ?? 0)

      if (pointsRow.data?.id) {
        const updateRes = await admin
          .from('client_points')
          .update({ solde: current + points, total_visites: visits + 1 })
          .eq('id', pointsRow.data.id)

        if (updateRes.error) {
          return buildApiError('update_error', updateRes.error.message, 500, ctx.request_id)
        }
      } else {
        const insertRes = await admin.from('client_points').insert({
          client_id: profile.data.id,
          fournisseur_id: ctx.fournisseur_id,
          solde: points,
          total_visites: 1,
        })

        if (insertRes.error) {
          return buildApiError('insert_error', insertRes.error.message, 500, ctx.request_id)
        }
      }

      void dispatchWebhookEvent({
        fournisseur_id: ctx.fournisseur_id,
        event_type: 'transaction.validated',
        payload: {
          id: transaction.data.id,
          client_id: profile.data.id,
          service_id: body.service_id ?? null,
          montant: body.montant,
          points_credited: points,
          status: 'validated',
          created_at: new Date().toISOString(),
        },
      })

      return buildApiResponse(
        {
          transaction_id: transaction.data.id,
          points_credited: points,
          new_balance: current + points,
          description: body.description ?? null,
        },
        { request_id: ctx.request_id, rate_limit_remaining: ctx.rate_limit_remaining },
      )
    }

    if (req.method === 'GET' && maybeId && maybeId !== 'api-v1-transactions') {
      checkScope('read', ctx.scopes)

      const tx = await admin
        .from('transactions')
        .select('id, client_id, service_id, montant, points_credited, status, created_at')
        .eq('id', maybeId)
        .eq('fournisseur_id', ctx.fournisseur_id)
        .maybeSingle()

      if (tx.error || !tx.data) {
        return buildApiError('not_found', 'Transaction not found', 404, ctx.request_id)
      }

      return buildApiResponse(tx.data, {
        request_id: ctx.request_id,
        rate_limit_remaining: ctx.rate_limit_remaining,
      })
    }

    return buildApiError('not_implemented', 'Unsupported route or method', 404, ctx.request_id)
  })
})
