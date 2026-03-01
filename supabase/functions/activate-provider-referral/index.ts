import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface ActivateProviderReferralRequest {
  referral_code: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 })
    }

    const referredProviderId = user.id
    const { referral_code } = (await req.json()) as ActivateProviderReferralRequest

    if (!referral_code) {
      return new Response(JSON.stringify({ error: 'Missing referral_code' }), { status: 400 })
    }

    const { data: referredProvider, error: providerError } = await supabase
      .from('fournisseurs')
      .select('id')
      .eq('id', referredProviderId)
      .single()

    if (providerError || !referredProvider) {
      return new Response(JSON.stringify({ error: 'Provider account not found' }), { status: 404 })
    }

    const { data: referral, error: referralError } = await supabase
      .from('provider_referrals')
      .select('id, referrer_id, referred_id, status')
      .eq('referral_code', referral_code)
      .single()

    if (referralError || !referral) {
      return new Response(JSON.stringify({ error: 'Referral code not found' }), { status: 404 })
    }

    if (referral.referrer_id === referredProviderId) {
      return new Response(JSON.stringify({ error: 'Cannot activate your own referral code' }), { status: 400 })
    }

    if (referral.status === 'activated' || referral.status === 'rewarded') {
      return new Response(JSON.stringify({ error: 'Referral code already activated' }), { status: 400 })
    }

    if (referral.referred_id) {
      return new Response(JSON.stringify({ error: 'Referral code already claimed' }), { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('provider_referrals')
      .update({
        referred_id: referredProviderId,
        status: 'activated',
        activated_at: new Date().toISOString(),
      })
      .eq('id', referral.id)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 })
    }

    return new Response(
      JSON.stringify({
        activated: true,
        referrer_id: referral.referrer_id,
        referred_id: referredProviderId,
        referral_code,
      }),
      { status: 200 },
    )
  } catch (error) {
    console.error('Unexpected error in activate-provider-referral:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
