import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type UnlockRewardRequest = {
  client_reward_id?: string
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
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

    const authClient = createClient(supabaseUrl, anonKey)
    const { data: userData, error: userError } = await authClient.auth.getUser(jwt)

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const clientId = userData.user.id
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: rewardData, error: rewardError } = await adminClient
      .from('client_rewards')
      .select('id, client_id, status, reward_rule_id')
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

    if (rewardData.client_id !== clientId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (rewardData.status !== 'available') {
      return new Response(JSON.stringify({ error: 'Reward is not available' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rewardRuleData, error: rewardRuleError } = await adminClient
      .from('reward_rules')
      .select('id, points_required')
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

    const { data: rpcData, error: rpcError } = await adminClient.rpc('consume_client_reward', {
      p_client_reward_id: payload.client_reward_id,
      p_client_id: clientId,
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
