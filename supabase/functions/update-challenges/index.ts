import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface UpdateChallengesRequest {
  client_id: string
  event_type: string
  // 'visit_count' | 'spend_amount' | 'streak' | 'referral' | 'provider_count' | 'transfer'
  value: number
}

interface ChallengeUpdate {
  challenge_id: string
  completed: boolean
  current_value: number
  target_value: number
}

interface UpdateChallengesResponse {
  challenges_updated: ChallengeUpdate[]
  challenges_completed: string[]
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { client_id, event_type, value } = (await req.json()) as UpdateChallengesRequest

    if (!client_id || !event_type || value === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: client_id, event_type, value' }),
        { status: 400 },
      )
    }

    // 1. Fetch active challenges matching event_type
    const now = new Date().toISOString()
    const { data: challenges, error: challengesError } = await supabase
      .from('challenges')
      .select('id, type, target_value, reward_points, reward_xp, reward_badge_id, fournisseur_id')
      .eq('type', event_type)
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now)

    if (challengesError) {
      console.error('Fetch challenges error:', challengesError)
      return new Response(JSON.stringify({ error: challengesError.message }), { status: 500 })
    }

    if (!challenges || challenges.length === 0) {
      return new Response(
        JSON.stringify({
          challenges_updated: [],
          challenges_completed: [],
        } as UpdateChallengesResponse),
        { status: 200 },
      )
    }

    const updatesResult: ChallengeUpdate[] = []
    const completedIds: string[] = []

    // 2. For each challenge, UPSERT progress and check completion
    for (const challenge of challenges) {
      // Fetch or create progress record
      const { data: progressData, error: progressError } = await supabase
        .from('client_challenge_progress')
        .select('id, current_value, completed, rewarded')
        .eq('client_id', client_id)
        .eq('challenge_id', challenge.id)
        .single()

      if (progressError && progressError.code !== 'PGRST116') {
        console.error('Fetch progress error:', progressError)
        return new Response(JSON.stringify({ error: progressError.message }), { status: 500 })
      }

      const currentValue = (progressData?.current_value ?? 0) as number
      const newValue = currentValue + value

      // Determine if newly completed
      const wasCompleted = progressData?.completed ?? false
      const isNowCompleted = newValue >= (challenge.target_value ?? 0)
      const newlyCompleted = !wasCompleted && isNowCompleted

      // UPSERT progress
      const { error: upsertError } = await supabase.from('client_challenge_progress').upsert({
        client_id,
        challenge_id: challenge.id,
        current_value: newValue,
        completed: isNowCompleted,
        completed_at: newlyCompleted ? new Date().toISOString() : progressData?.completed ? undefined : null,
      })

      if (upsertError) {
        console.error('UPSERT progress error:', upsertError)
        return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
      }

      updatesResult.push({
        challenge_id: challenge.id,
        completed: isNowCompleted,
        current_value: newValue,
        target_value: challenge.target_value ?? 0,
      })

      // 3. If newly completed, award rewards
      if (newlyCompleted) {
        completedIds.push(challenge.id)

        // Award points
        if (challenge.reward_points && challenge.reward_points > 0) {
          try {
            // Award to primary provider (if challenge is provider-specific)
            if (challenge.fournisseur_id) {
              const { error: creditError } = await supabase
                .from('client_points')
                .update({
                  solde: (0 || 0) + challenge.reward_points,
                  updated_at: new Date().toISOString(),
                })
                .eq('client_id', client_id)
                .eq('fournisseur_id', challenge.fournisseur_id)

              if (!creditError) {
                // Log transaction
                await supabase
                  .from('transactions')
                  .insert({
                    client_id,
                    fournisseur_id: challenge.fournisseur_id,
                    montant: 0,
                    raison: 'challenge_reward',
                    points: challenge.reward_points,
                    valide: true,
                  })
                  .catch((e) => console.warn('Failed to log challenge reward transaction:', e))
              }
            }
          } catch (creditError) {
            console.warn('Failed to award challenge points:', creditError)
          }
        }

        // Award XP
        if (challenge.reward_xp && challenge.reward_xp > 0) {
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/award-xp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                client_id,
                xp_amount: challenge.reward_xp,
                source: 'challenge',
                reference_id: challenge.id,
              }),
            })
          } catch (xpError) {
            console.warn('Failed to award challenge XP:', xpError)
          }
        }

        // Award badge
        if (challenge.reward_badge_id) {
          try {
            const { error: badgeError } = await supabase.from('client_badges').insert({
              client_id,
              badge_id: challenge.reward_badge_id,
            })

            if (!badgeError) {
              // Fetch badge details for notification
              const { data: badgeDef } = await supabase
                .from('badge_definitions')
                .select('emoji, name, rarity')
                .eq('id', challenge.reward_badge_id)
                .single()

              // Award badge XP
              const rarityXpMap: Record<string, number> = {
                common: 50,
                rare: 100,
                epic: 200,
                legendary: 500,
              }

              const badgeXp = rarityXpMap[badgeDef?.rarity ?? 'common'] ?? 50

              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/award-xp`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  client_id,
                  xp_amount: badgeXp,
                  source: 'badge',
                  reference_id: challenge.reward_badge_id,
                }),
              })
            }
          } catch (badgeError) {
            console.warn('Failed to award challenge badge:', badgeError)
          }
        }

        // Send notification
        try {
          await supabase.from('notifications').insert({
            user_id: client_id,
            type: 'challenge_completed',
            title: '🎯 Défi complété!',
            body: `Vous avez complété un défi! +${challenge.reward_points} pts +${challenge.reward_xp} XP`,
            data: {
              challenge_id: challenge.id,
            },
          })
        } catch (notifError) {
          console.warn('Failed to send challenge notification:', notifError)
        }
      }
    }

    return new Response(
      JSON.stringify({
        challenges_updated: updatesResult,
        challenges_completed: completedIds,
      } as UpdateChallengesResponse),
      { status: 200 },
    )
  } catch (error) {
    console.error('Unexpected error in update-challenges:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
