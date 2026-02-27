import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface GenerateProviderReferralRequest {
  // No params - uses auth context
}

interface GenerateProviderReferralResponse {
  referral_code: string
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
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
      })
    }

    // Extract JWT and get user
    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 })
    }

    const referrer_id = user.id

    // Verify user is a provider
    const { data: provider, error: providerError } = await supabase
      .from('fournisseurs')
      .select('id, tier')
      .eq('id', referrer_id)
      .single()

    if (providerError || !provider) {
      return new Response(JSON.stringify({ error: 'Provider not found' }), { status: 404 })
    }

    // Generate unique code
    let referral_code: string
    let codeExists = true
    let attempts = 0

    while (codeExists && attempts < 10) {
      const randomPart = generateCode(6)
      referral_code = `PRO-${randomPart}`

      const { data: existing } = await supabase
        .from('provider_referrals')
        .select('id')
        .eq('referral_code', referral_code)
        .single()

      codeExists = !!existing
      attempts++
    }

    if (codeExists) {
      return new Response(JSON.stringify({ error: 'Failed to generate unique code' }), {
        status: 500,
      })
    }

    // Create provider referral record
    const { error: createError } = await supabase.from('provider_referrals').insert({
      referrer_id,
      referred_id: null,
      referral_code,
      status: 'pending',
      commission_pct: 0.1,
      commission_earned: 0,
    })

    if (createError) {
      console.error('Create provider referral error:', createError)
      return new Response(JSON.stringify({ error: createError.message }), { status: 500 })
    }

    const baseUrl = Deno.env.get('PUBLIC_URL') ?? 'https://loyalup.app'
    const share_url = `${baseUrl}/provider/join/${referral_code}`

    return new Response(
      JSON.stringify({
        referral_code,
        share_url,
      } as GenerateProviderReferralResponse),
      { status: 200 },
    )
  } catch (error) {
    console.error('Unexpected error in generate-provider-referral:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
