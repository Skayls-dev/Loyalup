import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildApiError, buildApiResponse, checkScope, corsHeaders, withApiAuth } from '../_shared/apiAuth.ts'
import { dispatchWebhookEvent } from '../_shared/webhookDispatch.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return withApiAuth(req, '/api/v1/clients', async (ctx) => {
    if (ctx.environment !== 'production') {
      return buildApiError(
        'sandbox_key_not_allowed',
        'Sandbox API keys can only be used with /api-v1-sandbox',
        403,
        ctx.request_id,
      )
    }

    checkScope('clients', ctx.scopes)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return buildApiError('server_config_error', 'Missing Supabase env', 500, ctx.request_id)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const maybeClientId = url.searchParams.get('client_id') ?? pathParts[pathParts.length - 1]
    const isPointsRoute = pathParts.includes('points')

    if (req.method === 'GET' && !isPointsRoute && (!maybeClientId || maybeClientId === 'api-v1-clients')) {
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 20)))
      const from = (page - 1) * limit
      const to = from + limit - 1
      const minPoints = Number(url.searchParams.get('min_points') ?? 0)
      const segment = url.searchParams.get('segment')

      const pointsResult = await admin
        .from('client_points')
        .select('client_id, solde, total_visites, created_at', { count: 'exact' })
        .eq('fournisseur_id', ctx.fournisseur_id)
        .gte('solde', minPoints)
        .range(from, to)

      if (pointsResult.error) {
        return buildApiError('query_error', pointsResult.error.message, 500, ctx.request_id)
      }

      const pointsRows = (pointsResult.data ?? []) as Array<{
        client_id: string
        solde: number
        total_visites: number
        created_at: string
      }>

      const clientIds = pointsRows.map((row: { client_id: string }) => String(row.client_id))
      const { data: profiles } = clientIds.length
        ? await admin
            .from('profiles')
            .select('id, nom, email, created_at')
            .in('id', clientIds)
        : { data: [] as Array<{ id: string; nom: string; email: string; created_at: string }> }

      const { data: segments } = clientIds.length
        ? await admin
            .from('user_segments')
            .select('client_id, segment_type, computed_at')
            .in('client_id', clientIds)
            .order('computed_at', { ascending: false })
        : { data: [] as Array<{ client_id: string; segment_type: string; computed_at: string }> }

      const typedProfiles = (profiles ?? []) as Array<{
        id: string
        nom: string
        email: string
        created_at: string
      }>

      const profileMap = new Map(typedProfiles.map((profile) => [profile.id, profile]))
      const segmentMap = new Map<string, string>()

      for (const segmentRow of segments ?? []) {
        const id = String(segmentRow.client_id)
        if (!segmentMap.has(id)) {
          segmentMap.set(id, String(segmentRow.segment_type))
        }
      }

      const items = pointsRows
        .map((row) => {
          const profile = profileMap.get(String(row.client_id))
          return {
            id: String(row.client_id),
            name: profile?.nom ?? '',
            email: profile?.email ?? '',
            points: Number(row.solde ?? 0),
            total_visites: Number(row.total_visites ?? 0),
            enrolled_at: profile?.created_at ?? row.created_at,
            segment: segmentMap.get(String(row.client_id)) ?? null,
          }
        })
        .filter((item: { segment: string | null }) => (segment ? item.segment === segment : true))

      return buildApiResponse(
        {
          items,
          pagination: {
            page,
            limit,
            total: pointsResult.count ?? items.length,
          },
        },
        { request_id: ctx.request_id, rate_limit_remaining: ctx.rate_limit_remaining },
      )
    }

    if (req.method === 'GET' && !isPointsRoute && maybeClientId && maybeClientId !== 'api-v1-clients') {
      const clientId = maybeClientId

      const [profileResult, pointsResult, txResult] = await Promise.all([
        admin.from('profiles').select('id, nom, email, created_at').eq('id', clientId).maybeSingle(),
        admin
          .from('client_points')
          .select('solde, total_visites, updated_at')
          .eq('fournisseur_id', ctx.fournisseur_id)
          .eq('client_id', clientId)
          .maybeSingle(),
        admin
          .from('transactions')
          .select('id, montant, points_credited, status, created_at')
          .eq('fournisseur_id', ctx.fournisseur_id)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (profileResult.error || !profileResult.data) {
        return buildApiError('not_found', 'Client not found', 404, ctx.request_id)
      }

      if (pointsResult.error || !pointsResult.data) {
        return buildApiError('not_found', 'Client not enrolled in this provider', 404, ctx.request_id)
      }

      return buildApiResponse(
        {
          profile: profileResult.data,
          loyalty: {
            points: Number(pointsResult.data.solde ?? 0),
            total_visites: Number(pointsResult.data.total_visites ?? 0),
            updated_at: pointsResult.data.updated_at,
          },
          recent_transactions: txResult.data ?? [],
        },
        { request_id: ctx.request_id, rate_limit_remaining: ctx.rate_limit_remaining },
      )
    }

    if (req.method === 'POST' && isPointsRoute && maybeClientId) {
      checkScope('transactions', ctx.scopes)

      const body = await req.json().catch(() => null) as null | {
        amount?: number
        description?: string
        type?: 'credit' | 'debit'
      }

      if (!body || typeof body.amount !== 'number' || !body.type) {
        return buildApiError('validation_error', 'Body must include amount and type', 400, ctx.request_id)
      }

      const pointsDelta = body.type === 'debit' ? -Math.abs(body.amount) : Math.abs(body.amount)

      const pointsRow = await admin
        .from('client_points')
        .select('id, solde, total_visites')
        .eq('fournisseur_id', ctx.fournisseur_id)
        .eq('client_id', maybeClientId)
        .maybeSingle<{ id: string; solde: number; total_visites: number }>()

      if (pointsRow.error || !pointsRow.data) {
        return buildApiError('not_found', 'Client loyalty row not found', 404, ctx.request_id)
      }

      const nextBalance = Number(pointsRow.data.solde ?? 0) + pointsDelta
      if (nextBalance < 0) {
        return buildApiError('validation_error', 'Insufficient points balance', 400, ctx.request_id)
      }

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
          client_id: maybeClientId,
          fournisseur_id: ctx.fournisseur_id,
          status: 'validated',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single<{ id: string }>()

      if (pending.error || !pending.data?.id) {
        return buildApiError('insert_error', 'Unable to create synthetic pending transaction', 500, ctx.request_id)
      }

      const txInsert = await admin.from('transactions').insert({
        pending_transaction_id: pending.data.id,
        client_id: maybeClientId,
        fournisseur_id: ctx.fournisseur_id,
        service_id: null,
        montant: 0,
        points_credited: pointsDelta,
        status: 'validated',
      })

      if (txInsert.error) {
        return buildApiError('insert_error', txInsert.error.message, 500, ctx.request_id)
      }

      const pointsUpdate = await admin
        .from('client_points')
        .update({
          solde: nextBalance,
          total_visites: Number(pointsRow.data.total_visites ?? 0) + 1,
        })
        .eq('id', pointsRow.data.id)

      if (pointsUpdate.error) {
        return buildApiError('update_error', pointsUpdate.error.message, 500, ctx.request_id)
      }

      void dispatchWebhookEvent({
        fournisseur_id: ctx.fournisseur_id,
        event_type: 'client.updated',
        payload: {
          id: maybeClientId,
          points_delta: pointsDelta,
          new_balance: nextBalance,
          type: body.type,
          description: body.description ?? null,
        },
      })

      return buildApiResponse(
        {
          client_id: maybeClientId,
          amount: pointsDelta,
          description: body.description ?? null,
          type: body.type,
          new_balance: nextBalance,
        },
        { request_id: ctx.request_id, rate_limit_remaining: ctx.rate_limit_remaining },
      )
    }

    return buildApiError('not_implemented', 'Unsupported route or method', 404, ctx.request_id)
  })
})
