import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface UpdateStreakRequest {
  client_id: string
  fournisseur_id?: string
  visit_date?: string
  // If not provided, defaults to today
}

interface UpdateStreakResponse {
  current_streak: number
  longest_streak: number
  streak_broken: boolean
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { client_id, fournisseur_id, visit_date: inputDate } =
      (await req.json()) as UpdateStreakRequest

    if (!client_id) {
      return new Response(JSON.stringify({ error: 'Missing client_id' }), { status: 400 })
    }

    // Use provided date or today
    const visitDate = inputDate ? new Date(inputDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]

    // Process two streaks: provider-specific (if fournisseur_id given) and global
    const streakQueries = []

    // Global streak (fournisseur_id = null)
    streakQueries.push({
      fournisseur_id: null,
      label: 'global',
    })

    // Provider-specific streak (if fournisseur_id provided)
    if (fournisseur_id) {
      streakQueries.push({
        fournisseur_id,
        label: 'provider',
      })
    }

    const results = { global: {}, provider: {} }

    for (const streakQuery of streakQueries) {
      const { fournisseur_id: fid, label } = streakQuery

      // 1. Fetch current streak record
      let query = supabase
        .from('client_streaks')
        .select('id, current_streak, longest_streak, last_visit_date, streak_broken_at')
        .eq('client_id', client_id)

      if (fid) {
        query = query.eq('fournisseur_id', fid)
      } else {
        query = query.is('fournisseur_id', null)
      }

      const { data: streakData, error: fetchError } = await query.single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(`Fetch streak error (${label}):`, fetchError)
        return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
      }

      let newCurrent = 1
      let newLongest = 1
      let streakBroken = false

      if (streakData) {
        const lastDate = streakData.last_visit_date

        if (lastDate) {
          const yesterday = new Date(visitDate)
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toISOString().split('T')[0]

          const today = new Date(visitDate).toISOString().split('T')[0]

          if (lastDate === today) {
            // Already visited today, streak unchanged
            newCurrent = streakData.current_streak
            newLongest = streakData.longest_streak
          } else if (lastDate === yesterdayStr) {
            // Visited yesterday, increment streak
            newCurrent = streakData.current_streak + 1
            newLongest = Math.max(newCurrent, streakData.longest_streak)
          } else {
            // Gap in visits, reset to 1
            newCurrent = 1
            newLongest = streakData.longest_streak
            streakBroken = true
          }
        }

        // Update existing record
        const { error: updateError } = await supabase
          .from('client_streaks')
          .update({
            current_streak: newCurrent,
            longest_streak: newLongest,
            last_visit_date: visitDate,
            streak_broken_at: streakBroken ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', streakData.id)

        if (updateError) {
          console.error(`Update streak error (${label}):`, updateError)
          return new Response(JSON.stringify({ error: updateError.message }), { status: 500 })
        }
      } else {
        // Create new streak record
        const { error: createError } = await supabase.from('client_streaks').insert({
          client_id,
          fournisseur_id: fid,
          current_streak: 1,
          longest_streak: 1,
          last_visit_date: visitDate,
          updated_at: new Date().toISOString(),
        })

        if (createError) {
          console.error(`Create streak error (${label}):`, createError)
          return new Response(JSON.stringify({ error: createError.message }), { status: 500 })
        }
      }

      results[label as keyof typeof results] = {
        current_streak: newCurrent,
        longest_streak: newLongest,
        streak_broken: streakBroken,
      }

      // Check for streak badges (7, 30, 100 days)
      const streakMilestones = [
        { days: 7, code: 'streak_7' },
        { days: 30, code: 'streak_30' },
        { days: 100, code: 'streak_100' },
      ]

      for (const milestone of streakMilestones) {
        if (newCurrent === milestone.days) {
          // Trigger badge check
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/check-badges`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                client_id,
                trigger_type: 'streak_days',
              }),
            })
          } catch (badgeError) {
            console.warn(`Failed to check streak badges:`, badgeError)
          }

          // Award XP
          const xpRewards: Record<number, number> = { 7: 100, 30: 300, 100: 1000 }
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/award-xp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                client_id,
                xp_amount: xpRewards[milestone.days] || 100,
                source: 'streak',
                reference_id: null,
              }),
            })
          } catch (xpError) {
            console.warn(`Failed to award XP for streak milestone:`, xpError)
          }
        }
      }
    }

    return new Response(JSON.stringify(results.global as UpdateStreakResponse), { status: 200 })
  } catch (error) {
    console.error('Unexpected error in update-streak:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
