import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ValidateBody = {
  token?: string
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

    const payload = (await req.json().catch(() => ({}))) as ValidateBody
    const token = payload.token?.trim()

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const clientId = userData.user.id

    const { data: qrToken, error: tokenError } = await adminClient
      .from('qr_tokens')
      .select('id, token, fournisseur_id, status, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (tokenError) {
      return new Response(JSON.stringify({ error: tokenError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!qrToken) {
      return new Response(JSON.stringify({ error: 'Token not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const tokenExpiresAt = new Date(qrToken.expires_at)

    if (qrToken.status !== 'active' || tokenExpiresAt <= now) {
      if (qrToken.status === 'active' && tokenExpiresAt <= now) {
        await adminClient.from('qr_tokens').update({ status: 'expired' }).eq('id', qrToken.id)
      }

      return new Response(JSON.stringify({ error: 'Token expired or already used' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pendingExpiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString()

    const { data: transaction, error: createTransactionError } = await adminClient
      .from('pending_transactions')
      .insert({
        qr_token_id: qrToken.id,
        client_id: clientId,
        fournisseur_id: qrToken.fournisseur_id,
        status: 'pending',
        expires_at: pendingExpiresAt,
      })
      .select('id')
      .single()

    if (createTransactionError) {
      return new Response(JSON.stringify({ error: createTransactionError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: markTokenUsedError } = await adminClient
      .from('qr_tokens')
      .update({ status: 'used' })
      .eq('id', qrToken.id)

    if (markTokenUsedError) {
      return new Response(JSON.stringify({ error: markTokenUsedError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        fournisseur_id: qrToken.fournisseur_id,
        transaction_id: transaction.id,
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
