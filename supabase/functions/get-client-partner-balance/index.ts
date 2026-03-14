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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Missing env vars' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: userResult, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userResult.user?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const userId = userResult.user.id

  const { data: wallet, error: walletError } = await admin
    .from('partner_points_wallets')
    .select('balance, updated_at')
    .eq('loyalup_user_id', userId)
    .maybeSingle<{ balance: number; updated_at: string }>()

  const { data: transfers, error: transfersError } = await admin
    .from('partner_point_transfers')
    .select('points_delta, processed_at')
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

  return json({
    success: true,
    loyalup_user_id: userId,
    partner_balance: partnerBalance,
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
