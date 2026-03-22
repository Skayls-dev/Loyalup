import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivateReferralRequest {
  referral_code: string
}

interface ActivateReferralResponse {
  activated: boolean
  message: string
  referrer_id?: string
  points_awarded?: number
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
    const payload = (await req.json()) as ActivateReferralRequest
    const authHeader = req.headers.get('authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract JWT and get user (referred user)
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

    const referred_id = user.id

    // 1. Find referral by code
    const { data: referral, error: referralError } = await supabase
      .from('client_referrals')
      .select('id, referrer_id, referred_id, status, expires_at, fournisseur_id')
      .eq('referral_code', payload.referral_code)
      .single()

    if (referralError || !referral) {
      return new Response(JSON.stringify({ error: 'Referral code not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Validate referral status
    if (new Date(referral.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Referral code expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (
      referral.referred_id === referred_id &&
      (referral.status === 'activated' || referral.status === 'rewarded')
    ) {
      return new Response(
        JSON.stringify({
          activated: true,
          message: referral.status === 'rewarded'
            ? 'Parrainage deja recompense.'
            : 'Parrainage deja active. Finalisez votre premier achat valide pour recevoir vos bonus.',
          referrer_id: referral.referrer_id,
        } as ActivateReferralResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (referral.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Referral code already used' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (referral.referrer_id === referred_id) {
      return new Response(JSON.stringify({ error: 'Cannot refer yourself' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (referral.referred_id && referral.referred_id !== referred_id) {
      return new Response(JSON.stringify({ error: 'This referral has already been claimed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Update referral to activated
    const { error: updateError } = await supabase
      .from('client_referrals')
      .update({
        referred_id,
        status: 'activated',
        activated_at: new Date().toISOString(),
      })
      .eq('id', referral.id)

    if (updateError) {
      console.error('Update referral error:', updateError)
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Wait for first scan by referred user before final reward
    // This happens in a separate trigger or job after transaction creation

    return new Response(
      JSON.stringify({
        activated: true,
        message: 'Referral activated! Complete your first scan to earn rewards.',
        referrer_id: referral.referrer_id,
      } as ActivateReferralResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Unexpected error in activate-referral:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
