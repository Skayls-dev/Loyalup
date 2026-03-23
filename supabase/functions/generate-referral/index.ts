import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateReferralRequest {
  fournisseur_id?: string
}

interface GenerateReferralResponse {
  referral_code: string
  expires_at: string
  share_url: string
}

// Generate random alphanumeric code
function generateCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
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
    const payload = (await req.json()) as GenerateReferralRequest
    const authHeader = req.headers.get('authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract JWT and get user
    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const referrer_id = user.id
    const fournisseur_id = payload.fournisseur_id

    // Verify user is a client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', referrer_id)
      .single()

    if (profileError || profile?.role !== 'client') {
      return new Response(JSON.stringify({ error: 'Only clients can generate referral codes' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate unique code
    let referral_code: string
    let codeExists = true
    let attempts = 0

    while (codeExists && attempts < 10) {
      const providerCode = fournisseur_id ? fournisseur_id.substring(0, 4).toUpperCase() : 'LU'
      const randomPart = generateCode(6)
      referral_code = `${providerCode}-${randomPart}`

      const { data: existing } = await supabase
        .from('client_referrals')
        .select('id')
        .eq('referral_code', referral_code)
        .single()

      codeExists = !!existing
      attempts++
    }

    if (codeExists) {
      return new Response(JSON.stringify({ error: 'Failed to generate unique code' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create referral record
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + 30)

    const { error: createError } = await supabase.from('client_referrals').insert({
      referrer_id,
      referred_id: null,
      referral_code,
      status: 'pending',
      fournisseur_id: fournisseur_id ?? null,
      expires_at: expires_at.toISOString(),
    })

    if (createError) {
      console.error('Create referral error:', createError)
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = Deno.env.get('PUBLIC_URL') ?? 'https://looyaal.com'
    const share_url = `${baseUrl}/join/${referral_code}`

    return new Response(
      JSON.stringify({
        referral_code,
        expires_at: expires_at.toISOString(),
        share_url,
      } as GenerateReferralResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Unexpected error in generate-referral:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
