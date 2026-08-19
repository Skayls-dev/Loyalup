import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key',
}

type TransferPointsRequest = {
  client_id?: string
  from_fournisseur_id?: string
  to_fournisseur_id?: string
  points_to_transfer?: number
  idempotency_key?: string
}

type TransferResult = {
  points_deducted: number
  platform_fee: number
  points_credited: number
  conversion_rate: number
  from_new_balance: number
  to_new_balance: number
  transfer_id: string
  replayed: boolean
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Missing server configuration' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const jwt = authHeader.slice('Bearer '.length).trim()
    const authClient = createClient(supabaseUrl, anonKey)
    const { data: userData, error: userError } = await authClient.auth.getUser(jwt)

    if (userError || !userData.user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = (await req.json().catch(() => null)) as TransferPointsRequest | null
    if (!body) {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    if (body.client_id && body.client_id !== userData.user.id) {
      return json({ error: 'Forbidden' }, 403)
    }

    const fromProviderId = body.from_fournisseur_id?.trim()
    const toProviderId = body.to_fournisseur_id?.trim()
    const pointsToTransfer = Number(body.points_to_transfer)
    const idempotencyKey =
      req.headers.get('Idempotency-Key')?.trim() || body.idempotency_key?.trim()

    if (!fromProviderId || !toProviderId) {
      return json({ error: 'Source and destination providers are required' }, 400)
    }

    if (!Number.isInteger(pointsToTransfer) || pointsToTransfer <= 0) {
      return json({ error: 'points_to_transfer must be a positive integer' }, 400)
    }

    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return json({ error: 'A valid Idempotency-Key header is required' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await adminClient.rpc('transfer_points_transaction', {
      p_client_id: userData.user.id,
      p_from_fournisseur_id: fromProviderId,
      p_to_fournisseur_id: toProviderId,
      p_points_to_transfer: pointsToTransfer,
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      return mapTransferError(error.message)
    }

    const result = (Array.isArray(data) ? data[0] : data) as TransferResult | null
    if (!result) {
      return json({ error: 'Transfer returned no result' }, 500)
    }

    if (!result.replayed) {
      await runPostTransferEffects(adminClient, supabaseUrl, serviceRoleKey, userData.user.id, result)
    }

    return json(result)
  } catch (error) {
    console.error('Unexpected error in transfer-points:', error)
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})

function mapTransferError(message: string): Response {
  if (message.includes('SAME_PROVIDER')) {
    return json({ error: 'Cannot transfer points to the same provider' }, 400)
  }

  if (message.includes('INVALID_POINTS') || message.includes('INVALID_IDEMPOTENCY_KEY')) {
    return json({ error: 'Invalid transfer request' }, 400)
  }

  if (message.includes('IDEMPOTENCY_CONFLICT')) {
    return json({ error: 'Idempotency key already used with a different transfer' }, 409)
  }

  if (message.includes('INSUFFICIENT_POINTS')) {
    return json({ error: 'Insufficient points' }, 409)
  }

  if (message.includes('COALITION_NOT_FOUND')) {
    return json({ error: 'Providers are not in the same active coalition' }, 409)
  }

  console.error('transfer_points_transaction failed:', message)
  return json({ error: 'Transfer failed' }, 500)
}

async function runPostTransferEffects(
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  clientId: string,
  result: TransferResult,
): Promise<void> {
  const internalHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceRoleKey}`,
  }

  const effects = await Promise.allSettled([
    fetch(`${supabaseUrl}/functions/v1/award-xp`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({ client_id: clientId, xp_amount: 20, source: 'transfer' }),
    }),
    fetch(`${supabaseUrl}/functions/v1/check-badges`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({ client_id: clientId, trigger_type: 'transfer_count' }),
    }),
    fetch(`${supabaseUrl}/functions/v1/update-challenges`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({ client_id: clientId, event_type: 'transfer', value: 1 }),
    }),
    adminClient.from('notifications').insert({
      user_id: clientId,
      type: 'transfer_completed',
      title: 'Points transférés',
      body: `${result.points_credited} points transférés avec succès`,
      data: {
        transfer_id: result.transfer_id,
        from_points_deducted: result.points_deducted,
        to_points_credited: result.points_credited,
        platform_fee: result.platform_fee,
      },
    }),
  ])

  effects.forEach((effect, index) => {
    if (effect.status === 'rejected') {
      console.warn(`Post-transfer effect ${index} failed:`, effect.reason)
    }
  })
}