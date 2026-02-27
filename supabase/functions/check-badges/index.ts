import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface CheckBadgesRequest {
  client_id: string
  trigger_type?: string
  // 'transaction_count' | 'points_total' | 'provider_count' etc
}

interface BadgeAward {
  badge_id: string
  code: string
  emoji: string
  rarity: string
}

interface CheckBadgesResponse {
  badges_awarded: BadgeAward[]
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { client_id, trigger_type } = (await req.json()) as CheckBadgesRequest

    if (!client_id) {
      return new Response(JSON.stringify({ error: 'Missing client_id' }), { status: 400 })
    }

    // 1. Fetch active badge definitions (filter by trigger_type if provided)
    let query = supabase
      .from('badge_definitions')
      .select('id, code, name, emoji, category, rarity, trigger_type, trigger_value, is_secret, points_reward')
      .eq('is_active', true)

    if (trigger_type) {
      query = query.eq('trigger_type', trigger_type)
    }

    const { data: badges, error: badgesError } = await query

    if (badgesError) {
      console.error('Fetch badges error:', badgesError)
      return new Response(JSON.stringify({ error: badgesError.message }), { status: 500 })
    }

    // 2. Fetch client's current stats
    const { data: stats, error: statsError } = await supabase
      .rpc('get_client_gamification_stats', { p_client_id: client_id })

    if (statsError) {
      console.error('RPC get_client_gamification_stats error:', statsError)
      // Continue anyway with manual fetch
    }

    // Fallback manual stat fetching
    const clientStats = stats || {}

    // Fill in missing stats
    if (!clientStats.transaction_count) {
      const { data: txCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact' })
        .eq('client_id', client_id)
        .eq('valide', true)

      clientStats.transaction_count = txCount?.length ?? 0
    }

    if (!clientStats.points_total) {
      const { data: points } = await supabase
        .from('client_points')
        .select('solde')
        .eq('client_id', client_id)

      clientStats.points_total = points?.reduce((sum, row) => sum + (row.solde ?? 0), 0) ?? 0
    }

    if (!clientStats.provider_count) {
      const { data: providers } = await supabase
        .from('client_points')
        .select('fournisseur_id')
        .eq('client_id', client_id)

      const uniqueProviders = new Set(providers?.map((p) => p.fournisseur_id) ?? [])
      clientStats.provider_count = uniqueProviders.size
    }

    if (!clientStats.referral_count) {
      const { data: referrals } = await supabase
        .from('client_referrals')
        .select('id')
        .eq('referrer_id', client_id)
        .eq('status', 'rewarded')

      clientStats.referral_count = referrals?.length ?? 0
    }

    if (!clientStats.transfer_count) {
      const { data: transfers } = await supabase
        .from('point_transfers')
        .select('id')
        .eq('client_id', client_id)

      clientStats.transfer_count = transfers?.length ?? 0
    }

    if (!clientStats.streak_days) {
      const { data: streak } = await supabase
        .from('client_streaks')
        .select('current_streak')
        .eq('client_id', client_id)
        .is('fournisseur_id', null)
        .single()

      clientStats.streak_days = streak?.current_streak ?? 0
    }

    // 3. Fetch badges already earned
    const { data: earnedBadges, error: earnedError } = await supabase
      .from('client_badges')
      .select('badge_id')
      .eq('client_id', client_id)

    if (earnedError) {
      console.error('Fetch earned badges error:', earnedError)
      return new Response(JSON.stringify({ error: earnedError.message }), { status: 500 })
    }

    const earnedBadgeIds = new Set((earnedBadges ?? []).map((b) => b.badge_id))

    // 4. Check each badge condition
    const badgesToAward: BadgeAward[] = []

    for (const badge of badges ?? []) {
      // Skip if already earned
      if (earnedBadgeIds.has(badge.id)) {
        continue
      }

      // Check if trigger condition is met
      let qualified = false

      switch (badge.trigger_type) {
        case 'transaction_count':
          qualified = (clientStats.transaction_count ?? 0) >= (badge.trigger_value ?? 0)
          break
        case 'points_total':
          qualified = (clientStats.points_total ?? 0) >= (badge.trigger_value ?? 0)
          break
        case 'provider_count':
          qualified = (clientStats.provider_count ?? 0) >= (badge.trigger_value ?? 0)
          break
        case 'referral_count':
          qualified = (clientStats.referral_count ?? 0) >= (badge.trigger_value ?? 0)
          break
        case 'streak_days':
          qualified = (clientStats.streak_days ?? 0) >= (badge.trigger_value ?? 0)
          break
        case 'transfer_count':
          qualified = (clientStats.transfer_count ?? 0) >= (badge.trigger_value ?? 0)
          break
        case 'spend_amount':
          qualified = (clientStats.spend_amount ?? 0) >= (badge.trigger_value ?? 0)
          break
        case 'manual':
          // Manual badges won't be auto-awarded here
          qualified = false
          break
      }

      if (qualified) {
        badgesToAward.push({
          badge_id: badge.id,
          code: badge.code,
          emoji: badge.emoji,
          rarity: badge.rarity,
        })
      }
    }

    // 5. Award new badges
    if (badgesToAward.length > 0) {
      const badgeInserts = badgesToAward.map((b) => ({
        client_id,
        badge_id: b.badge_id,
        unlocked_at: new Date().toISOString(),
      }))

      const { error: insertError } = await supabase.from('client_badges').insert(badgeInserts)

      if (insertError) {
        console.error('Insert client_badges error:', insertError)
        return new Response(JSON.stringify({ error: insertError.message }), { status: 500 })
      }

      // Award XP for each badge
      for (const badge of badgesToAward) {
        const badgeDef = badges!.find((b) => b.id === badge.badge_id)!
        let xpReward = 50 // common

        if (badgeDef.rarity === 'rare') xpReward = 100
        if (badgeDef.rarity === 'epic') xpReward = 200
        if (badgeDef.rarity === 'legendary') xpReward = 500

        try {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/award-xp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              client_id,
              xp_amount: xpReward,
              source: 'badge',
              reference_id: badge.badge_id,
            }),
          })
        } catch (xpError) {
          console.warn(`Failed to award XP for badge ${badge.code}:`, xpError)
        }

        // Send badge notification
        try {
          await supabase.from('notifications').insert({
            user_id: client_id,
            type: 'badge_unlocked',
            title: '🏆 Badge débloqué!',
            body: `Vous avez débloqué le badge ${badge.emoji}`,
            icon: badge.emoji,
            data: {
              badge_code: badgeDef.code,
              badge_name: badgeDef.name,
              rarity: badge.rarity,
            },
          })
        } catch (notifError) {
          console.warn('Failed to send badge notification:', notifError)
        }
      }
    }

    return new Response(
      JSON.stringify({
        badges_awarded: badgesToAward,
      } as CheckBadgesResponse),
      { status: 200 },
    )
  } catch (error) {
    console.error('Unexpected error in check-badges:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
