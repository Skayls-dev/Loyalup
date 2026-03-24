import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type UnlockRewardRequest = {
  client_reward_id?: string
  pending_transaction_id?: string
}

function parseJwtSub(jwt: string): string | null {
  try {
    const payloadPart = jwt.split('.')[1]
    if (!payloadPart) return null
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded)) as { sub?: unknown }
    return typeof payload.sub === 'string' && payload.sub.trim().length > 0 ? payload.sub : null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const jwt = authHeader.replace('Bearer ', '').trim()
    const payload = (await req.json().catch(() => ({}))) as UnlockRewardRequest

    if (!payload.client_reward_id) {
      return new Response(JSON.stringify({ error: 'client_reward_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pendingTransactionId = payload.pending_transaction_id?.trim() ?? ''

    // The request is already gateway-authenticated (verify_jwt=true).
    // Read caller identity directly from JWT payload to avoid extra auth roundtrips.
    const callerUserId = parseJwtSub(jwt)
    if (!callerUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: rewardData, error: rewardError } = await adminClient
      .from('client_rewards')
      .select('id, client_id, status, reward_rule_id, fournisseur_id')
      .eq('id', payload.client_reward_id)
      .maybeSingle()

    if (rewardError) {
      return new Response(JSON.stringify({ error: rewardError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!rewardData) {
      return new Response(JSON.stringify({ error: 'Reward not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: providerData, error: providerError } = await adminClient
      .from('fournisseurs')
      .select('id')
      .eq('user_id', callerUserId)
      .eq('id', rewardData.fournisseur_id)
      .maybeSingle()

    if (providerError) {
      return new Response(JSON.stringify({ error: providerError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isClientCaller = rewardData.client_id === callerUserId
    const isProviderCaller = Boolean(providerData?.id)

    if (!isClientCaller && !isProviderCaller) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (isProviderCaller && !pendingTransactionId) {
      return new Response(JSON.stringify({ error: 'PENDING_TRANSACTION_REQUIRED' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const targetClientId = rewardData.client_id

    if (rewardData.status !== 'available') {
      return new Response(JSON.stringify({ error: 'Reward is not available' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rewardRuleData, error: rewardRuleError } = await adminClient
      .from('reward_rules')
      .select('id, nom, points_required, requires_physical_presence')
      .eq('id', rewardData.reward_rule_id)
      .maybeSingle()

    if (rewardRuleError) {
      return new Response(JSON.stringify({ error: rewardRuleError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!rewardRuleData) {
      return new Response(JSON.stringify({ error: 'Reward rule not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For provider callers: validate that the pending transaction belongs to the right client+provider.
    // Clients with digital/non-physical rewards can self-redeem without a pending transaction.
    if (isProviderCaller) {
      const { data: pendingTransactionData, error: pendingTransactionError } = await adminClient
        .from('pending_transactions')
        .select('id')
        .eq('id', pendingTransactionId)
        .eq('client_id', targetClientId)
        .eq('fournisseur_id', rewardData.fournisseur_id)
        .eq('status', 'pending')
        .maybeSingle()

      if (pendingTransactionError) {
        return new Response(JSON.stringify({ error: pendingTransactionError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!pendingTransactionData) {
        return new Response(JSON.stringify({ error: 'INVALID_PENDING_TRANSACTION' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (rewardRuleData.requires_physical_presence === true && !pendingTransactionId) {
      // Client caller trying to self-redeem a physical-presence-only reward without a scan
      return new Response(JSON.stringify({ error: 'PHYSICAL_PRESENCE_REQUIRED' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rpcData, error: rpcError } = await adminClient.rpc('consume_client_reward', {
      p_client_reward_id: payload.client_reward_id,
      p_client_id: targetClientId,
    })

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = Array.isArray(rpcData) ? rpcData[0] : null

    if (!result?.success) {
      return new Response(JSON.stringify({ error: 'Failed to use reward' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Record redemption in transactions so it appears in client + merchant history.
    // Only when performed at the caisse (provider caller with a pending transaction).
    if (isProviderCaller && pendingTransactionId) {
      const pointsDeducted = result.points_deducted ?? rewardRuleData.points_required ?? 0
      const rewardLabel = `🎁 ${rewardRuleData.nom?.trim() || 'Récompense'}`
      await adminClient.from('transactions').insert({
        pending_transaction_id: pendingTransactionId,
        client_id: targetClientId,
        fournisseur_id: rewardData.fournisseur_id,
        service_id: null,
        service_nom_libre: rewardLabel,
        montant: 0,
        points_credited: -pointsDeducted,
        status: 'validated',
        transaction_type: 'reward_redemption',
      })
      // Intentionally not throwing on insert error — reward was already consumed successfully.
    }

    return new Response(
      JSON.stringify({
        success: true,
        points_deducted: result.points_deducted ?? rewardRuleData.points_required,
        new_balance: result.new_balance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
