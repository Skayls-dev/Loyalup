import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json({ error: 'Missing env vars' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // Standard Supabase pattern: create a user-scoped client with the caller's JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const userId = user.id

  const { data: wallet, error: walletError } = await admin
    .from('partner_points_wallets')
    .select('balance, updated_at')
    .eq('loyalup_user_id', userId)
    .maybeSingle<{ balance: number; updated_at: string }>()

  const { data: transfers, error: transfersError } = await admin
    .from('partner_point_transfers')
    .select('partner_id, points_delta, processed_at')
    .eq('loyalup_user_id', userId)
    .eq('status', 'accepted')

  if (walletError && transfersError) {
    return json({ error: transfersError.message || walletError.message }, 500)
  }

  const acceptedTransfers = ((transfers ?? []) as Array<{ points_delta: number; processed_at: string | null }>)
  const ledgerBalance = acceptedTransfers.reduce((sum, row) => sum + Number(row.points_delta ?? 0), 0)
  const latestProcessedAt = acceptedTransfers
    .map((row) => row.processed_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1) ?? null

  const walletBalance = Number(wallet?.balance ?? 0)
  const partnerBalance = acceptedTransfers.length > 0 ? ledgerBalance : walletBalance
  const updatedAt = latestProcessedAt ?? wallet?.updated_at ?? null

  const acceptedTransfersWithPartner = ((transfers ?? []) as Array<{ points_delta: number; processed_at: string | null; partner_id?: string }>)
  const partnerIds = Array.from(
    new Set(
      acceptedTransfersWithPartner
        .map((row) => row.partner_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  )

  const { data: providerLinks } = partnerIds.length > 0
    ? await admin
        .from('partner_provider_links')
        .select('partner_id, fournisseur_id')
        .in('partner_id', partnerIds)
    : { data: [] as Array<{ partner_id: string; fournisseur_id: string }> }

  const providerIdByPartnerId = new Map(
    ((providerLinks ?? []) as Array<{ partner_id: string; fournisseur_id: string }>).map((row) => [row.partner_id, row.fournisseur_id]),
  )

  const providerBalanceMap = new Map<string, number>()
  for (const row of acceptedTransfersWithPartner) {
    const partnerId = row.partner_id
    if (!partnerId) {
      continue
    }

    const fournisseurId = providerIdByPartnerId.get(partnerId)
    if (!fournisseurId) {
      continue
    }

    providerBalanceMap.set(
      fournisseurId,
      Number(providerBalanceMap.get(fournisseurId) ?? 0) + Number(row.points_delta ?? 0),
    )
  }

  const partnerBalancesByProvider = Array.from(providerBalanceMap.entries()).map(([fournisseur_id, balance]) => ({
    fournisseur_id,
    balance,
  }))

  return json({
    success: true,
    loyalup_user_id: userId,
    partner_balance: partnerBalance,
    partner_balances_by_provider: partnerBalancesByProvider,
    updated_at: updatedAt,
  })
})

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
