import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type UnlockRewardRequest = {
  client_reward_id?: string
  pending_transaction_id?: string
  access_token?: string
}

type RewardRow = {
  id: string
  client_id: string
  status: 'available' | 'used' | 'expired' | string
  reward_rule_id: string
  fournisseur_id: string
}

type RewardRuleRow = {
  id: string
  nom: string | null
  points_required: number | null
  requires_physical_presence: boolean | null
}

type ConsumeRewardResult = {
  success?: boolean
  points_deducted?: number
  new_balance?: number
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function resolveAccessToken(req: Request, payload: UnlockRewardRequest): string | null {
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim()
    if (token) {
      return token
    }
  }

  const bodyToken = payload.access_token?.trim()
  return bodyToken && bodyToken.length > 0 ? bodyToken : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return respond({ error: 'Missing Supabase environment variables' }, 500)
    }

    const payload = (await req.json().catch(() => ({}))) as UnlockRewardRequest

    if (!payload.client_reward_id) {
      return respond({ error: 'client_reward_id is required' }, 400)
    }

    const accessToken = resolveAccessToken(req, payload)
    if (!accessToken) {
      return respond({ error: 'Missing authorization header' }, 401)
    }

    const pendingTransactionId = payload.pending_transaction_id?.trim() ?? ''

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })

    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData.user) {
      return respond({ error: 'Unauthorized' }, 401)
    }

    const callerUserId = userData.user.id
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: rewardData, error: rewardError } = await adminClient
      .from('client_rewards')
      .select('id, client_id, status, reward_rule_id, fournisseur_id')
      .eq('id', payload.client_reward_id)
      .maybeSingle<RewardRow>()

    if (rewardError) {
      return respond({ error: rewardError.message }, 400)
    }

    if (!rewardData) {
      return respond({ error: 'Reward not found' }, 404)
    }

    const { data: providerData, error: providerError } = await adminClient
      .from('fournisseurs')
      .select('id')
      .eq('user_id', callerUserId)
      .eq('id', rewardData.fournisseur_id)
      .maybeSingle<{ id: string }>()

    if (providerError) {
      return respond({ error: providerError.message }, 400)
    }

    const isClientCaller = rewardData.client_id === callerUserId
    const isProviderCaller = Boolean(providerData?.id)

    if (!isClientCaller && !isProviderCaller) {
      return respond({ error: 'Forbidden' }, 403)
    }

    if (isProviderCaller && !pendingTransactionId) {
      return respond({ error: 'PENDING_TRANSACTION_REQUIRED' }, 403)
    }

    if (rewardData.status !== 'available') {
      return respond({ error: 'Reward is not available' }, 409)
    }

    const { data: rewardRuleData, error: rewardRuleError } = await adminClient
      .from('reward_rules')
      .select('id, nom, points_required, requires_physical_presence')
      .eq('id', rewardData.reward_rule_id)
      .maybeSingle<RewardRuleRow>()

    if (rewardRuleError) {
      return respond({ error: rewardRuleError.message }, 400)
    }

    if (!rewardRuleData) {
      return respond({ error: 'Reward rule not found' }, 404)
    }

    if (isProviderCaller) {
      const { data: pendingData, error: pendingError } = await adminClient
        .from('pending_transactions')
        .select('id')
        .eq('id', pendingTransactionId)
        .eq('client_id', rewardData.client_id)
        .eq('fournisseur_id', rewardData.fournisseur_id)
        .eq('status', 'pending')
        .maybeSingle<{ id: string }>()

      if (pendingError) {
        return respond({ error: pendingError.message }, 400)
      }

      if (!pendingData) {
        return respond({ error: 'INVALID_PENDING_TRANSACTION' }, 403)
      }
    } else if (rewardRuleData.requires_physical_presence === true && !pendingTransactionId) {
      return respond({ error: 'PHYSICAL_PRESENCE_REQUIRED' }, 403)
    }

    const { data: rpcData, error: rpcError } = await adminClient.rpc('consume_client_reward', {
      p_client_reward_id: payload.client_reward_id,
      p_client_id: rewardData.client_id,
    })

    if (rpcError) {
      return respond({ error: rpcError.message }, 400)
    }

    const result = (Array.isArray(rpcData) ? rpcData[0] : null) as ConsumeRewardResult | null
    if (!result?.success) {
      return respond({ error: 'Failed to use reward' }, 500)
    }

    if (isProviderCaller && pendingTransactionId) {
      const pointsDeducted = Number(result.points_deducted ?? rewardRuleData.points_required ?? 0)
      const rewardName = rewardRuleData.nom?.trim() || 'Reward'

      const { error: txError } = await adminClient.from('transactions').insert({
        pending_transaction_id: pendingTransactionId,
        client_id: rewardData.client_id,
        fournisseur_id: rewardData.fournisseur_id,
        service_id: null,
        service_nom_libre: `Reward: ${rewardName}`,
        montant: 0,
        points_credited: -pointsDeducted,
        status: 'validated',
      })

      if (txError) {
        console.error('unlock-reward transaction insert failed', txError.message)
      }
    }

    return respond({
      success: true,
      points_deducted: result.points_deducted ?? rewardRuleData.points_required,
      new_balance: result.new_balance,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return respond({ error: message }, 500)
  }
})
