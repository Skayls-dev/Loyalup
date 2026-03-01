import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface AwardXPRequest {
  client_id: string
  xp_amount: number
  source: string
  // 'scan' | 'badge' | 'referral' | 'streak' | 'transfer' | 'challenge' | 'bonus'
  reference_id?: string
}

interface AwardXPResponse {
  xp_awarded: number
  new_total: number
  leveled_up: boolean
  new_level?: number
  new_perks?: Array<{
    description: Record<string, string>
    type: string
    value: number
  }>
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { client_id, xp_amount, source, reference_id } = (await req.json()) as AwardXPRequest

    if (!client_id || !xp_amount || xp_amount <= 0 || !source) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: client_id, xp_amount > 0, source' }),
        { status: 400 },
      )
    }

    // 1. Record XP transaction
    const { error: txnError } = await supabase.from('xp_transactions').insert({
      client_id,
      xp_amount,
      source,
      reference_id: reference_id ?? null,
    })

    if (txnError) {
      console.error('XP transaction insert error:', txnError)
      return new Response(JSON.stringify({ error: txnError.message }), { status: 500 })
    }

    // 2. Get current client level info
    const { data: levelData, error: levelError } = await supabase
      .from('client_levels')
      .select('id, xp_total, current_level')
      .eq('client_id', client_id)
      .single()

    if (levelError && levelError.code !== 'PGRST116') {
      // PGRST116 = no rows
      console.error('Fetch client_levels error:', levelError)
      return new Response(JSON.stringify({ error: levelError.message }), { status: 500 })
    }

    // If no record, create one
    if (!levelData) {
      const { error: createError } = await supabase.from('client_levels').insert({
        client_id,
        xp_total: xp_amount,
        current_level: 1,
      })

      if (createError) {
        console.error('Create client_levels error:', createError)
        return new Response(JSON.stringify({ error: createError.message }), { status: 500 })
      }

      return new Response(
        JSON.stringify({
          xp_awarded: xp_amount,
          new_total: xp_amount,
          leveled_up: false,
        } as AwardXPResponse),
        { status: 200 },
      )
    }

    // 3. Compute new XP total
    const new_xp_total = levelData.xp_total + xp_amount

    // 4. Find level definition for new XP
    const { data: levelDef, error: levelDefError } = await supabase
      .from('level_definitions')
      .select('level_number, name, emoji, min_xp, max_xp, perks')
      .lte('min_xp', new_xp_total)
      .gt('max_xp', new_xp_total)
      .single()

    if (levelDefError) {
      console.error('Fetch level_definitions error:', levelDefError)
      return new Response(JSON.stringify({ error: levelDefError.message }), { status: 500 })
    }

    const leveled_up = levelDef.level_number > levelData.current_level

    // 5. Update client_levels
    const { error: updateError } = await supabase
      .from('client_levels')
      .update({
        xp_total: new_xp_total,
        current_level: levelDef.level_number,
        last_xp_earned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', client_id)

    if (updateError) {
      console.error('Update client_levels error:', updateError)
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 })
    }

    // 6. If leveled up, handle level-up perks & notification
    if (leveled_up) {
      // Send level-up notification
      try {
        await supabase.from('notifications').insert({
          user_id: client_id,
          type: 'level_up',
          title: `Niveau ${levelDef.level_number} atteint`,
          body: `Vous êtes passé au niveau ${levelDef.level_number}! 🎉`,
          icon: levelDef.emoji,
          data: {
            level: levelDef.level_number,
            name: levelDef.name,
            perks: levelDef.perks,
          },
        })
      } catch (notifError) {
        console.warn('Failed to send level-up notification:', notifError)
      }

      return new Response(
        JSON.stringify({
          xp_awarded: xp_amount,
          new_total: new_xp_total,
          leveled_up: true,
          new_level: levelDef.level_number,
          new_perks: levelDef.perks || [],
        } as AwardXPResponse),
        { status: 200 },
      )
    }

    // No level up
    return new Response(
      JSON.stringify({
        xp_awarded: xp_amount,
        new_total: new_xp_total,
        leveled_up: false,
      } as AwardXPResponse),
      { status: 200 },
    )
  } catch (error) {
    console.error('Unexpected error in award-xp:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
