import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ValidateBody = {
  token?: string
}

type ConsumeQrResult = {
  fournisseur_id: string
  transaction_id: string
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
      return json({ error: 'Missing Supabase environment variables' }, 500)
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

    const payload = (await req.json().catch(() => null)) as ValidateBody | null
    const tokenInput = payload?.token?.trim()

    if (!tokenInput || tokenInput.length > 100) {
      return json({ error: 'INVALID_TOKEN' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await adminClient.rpc('consume_qr_token', {
      p_client_id: userData.user.id,
      p_token_input: tokenInput,
    })

    if (error) {
      return mapConsumeError(error.message)
    }

    const result = (Array.isArray(data) ? data[0] : data) as ConsumeQrResult | null
    if (!result?.fournisseur_id || !result.transaction_id) {
      return json({ error: 'Invalid consume QR result' }, 500)
    }

    return json({
      success: true,
      fournisseur_id: result.fournisseur_id,
      transaction_id: result.transaction_id,
    })
  } catch (error) {
    console.error('Unexpected error in validate-qr:', error)
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})

function mapConsumeError(message: string): Response {
  if (message.includes('TOKEN_NOT_FOUND')) {
    return json({ error: 'TOKEN_NOT_FOUND' }, 404)
  }

  if (message.includes('TOKEN_EXPIRED')) {
    return json({ error: 'TOKEN_EXPIRED' }, 409)
  }

  if (message.includes('TOKEN_USED')) {
    return json({ error: 'TOKEN_USED' }, 409)
  }

  if (message.includes('INVALID_TOKEN')) {
    return json({ error: 'INVALID_TOKEN' }, 400)
  }

  if (message.includes('uq_pending_transactions_qr_token')) {
    return json({ error: 'TOKEN_USED' }, 409)
  }

  console.error('consume_qr_token failed:', message)
  return json({ error: 'QR_VALIDATION_FAILED' }, 500)
}