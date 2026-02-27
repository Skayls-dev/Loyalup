import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildApiError, buildApiResponse, checkScope, corsHeaders, withApiAuth } from '../_shared/apiAuth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return withApiAuth(req, '/api/v1/stats', async (ctx) => {
    if (ctx.environment !== 'production') {
      return buildApiError(
        'sandbox_key_not_allowed',
        'Sandbox API keys can only be used with /api-v1-sandbox',
        403,
        ctx.request_id,
      )
    }

    if (req.method !== 'GET') {
      return buildApiError('not_implemented', 'Unsupported method', 405, ctx.request_id)
    }

    checkScope('read', ctx.scopes)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return buildApiError('server_config_error', 'Missing Supabase env', 500, ctx.request_id)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const txResult = await admin
      .from('transactions')
      .select('id, montant, points_credited, created_at', { count: 'exact' })
      .eq('fournisseur_id', ctx.fournisseur_id)
      .eq('status', 'validated')

    if (txResult.error) {
      return buildApiError('query_error', txResult.error.message, 500, ctx.request_id)
    }

    const txRows = (txResult.data ?? []) as Array<{
      id: string
      montant: number
      points_credited: number
      created_at: string
    }>
    const totalRevenue = txRows.reduce((sum: number, row) => sum + Number(row.montant ?? 0), 0)
    const totalPoints = txRows.reduce((sum: number, row) => sum + Number(row.points_credited ?? 0), 0)
    const totalTransactions = txRows.length

    const pointsResult = await admin
      .from('client_points')
      .select('client_id, solde', { count: 'exact' })
      .eq('fournisseur_id', ctx.fournisseur_id)

    if (pointsResult.error) {
      return buildApiError('query_error', pointsResult.error.message, 500, ctx.request_id)
    }

    const activeClients = pointsResult.count ?? 0
    const avgBasket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

    return buildApiResponse(
      {
        total_revenue: totalRevenue,
        total_points_credited: totalPoints,
        total_transactions: totalTransactions,
        active_clients: activeClients,
        average_basket: Number(avgBasket.toFixed(2)),
      },
      { request_id: ctx.request_id, rate_limit_remaining: ctx.rate_limit_remaining },
    )
  })
})
