import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type DeletionStep = {
  step: string
  ok: boolean
  details?: string
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt)

  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userId = userData.user.id
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: existingRequest } = await adminClient
    .from('deletion_requests')
    .select('id, status')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingRequest?.status === 'completed') {
    return new Response(JSON.stringify({ success: true, steps_completed: ['already_completed'] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: requestRow, error: requestError } = existingRequest?.id
    ? await adminClient
        .from('deletion_requests')
        .update({ status: 'processing' })
        .eq('id', existingRequest.id)
        .select('id')
        .single()
    : await adminClient
        .from('deletion_requests')
        .insert({ user_id: userId, status: 'processing' })
        .select('id')
        .single()

  if (requestError || !requestRow?.id) {
    return new Response(JSON.stringify({ error: requestError?.message ?? 'Unable to create deletion request' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const steps: DeletionStep[] = []

  async function runStep(step: string, task: () => Promise<void>) {
    try {
      await task()
      steps.push({ step, ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error'
      steps.push({ step, ok: false, details: message })
    }
  }

  await runStep('anonymize_user_events', async () => {
    await adminClient
      .from('user_events')
      .update({ user_id: null, properties: { anonymized: true } })
      .eq('user_id', userId)
  })

  await runStep('delete_client_rewards', async () => {
    await adminClient.from('client_rewards').delete().eq('client_id', userId)
  })

  await runStep('delete_client_points', async () => {
    await adminClient.from('client_points').delete().eq('client_id', userId)
  })

  await runStep('anonymize_transactions', async () => {
    await adminClient.from('transactions').update({ client_id: null }).eq('client_id', userId)
  })

  await runStep('delete_push_subscriptions', async () => {
    await adminClient.from('push_subscriptions').delete().eq('user_id', userId)
  })

  await runStep('delete_notifications', async () => {
    await adminClient.from('notifications').delete().eq('user_id', userId)
  })

  await runStep('delete_user_consents', async () => {
    await adminClient.from('user_consents').delete().eq('user_id', userId)
  })

  await runStep('delete_profile_record', async () => {
    await adminClient.from('profiles').delete().eq('id', userId)
  })

  await runStep('delete_auth_user', async () => {
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) {
      throw error
    }
  })

  const failedSteps = steps.filter((step) => !step.ok)
  const isSuccess = failedSteps.length === 0

  await adminClient
    .from('deletion_requests')
    .update({
      status: isSuccess ? 'completed' : 'failed',
      completed_at: new Date().toISOString(),
      deletion_log: { steps },
    })
    .eq('id', requestRow.id)

  return new Response(
    JSON.stringify({
      success: isSuccess,
      steps_completed: steps.filter((step) => step.ok).map((step) => step.step),
      failed_steps: failedSteps,
    }),
    {
      status: isSuccess ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
