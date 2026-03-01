import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface TransferPointsRequest {
  client_id: string
  from_fournisseur_id: string
  to_fournisseur_id: string
  points_to_transfer: number
}

interface TransferPointsResponse {
  points_deducted: number
  platform_fee: number
  points_credited: number
  conversion_rate: number
  from_new_balance: number
  to_new_balance: number
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { client_id, from_fournisseur_id, to_fournisseur_id, points_to_transfer } =
      (await req.json()) as TransferPointsRequest

    if (
      !client_id ||
      !from_fournisseur_id ||
      !to_fournisseur_id ||
      typeof points_to_transfer !== 'number' ||
      points_to_transfer <= 0
    ) {
      return new Response(
        JSON.stringify({
          error: 'Missing/invalid required fields: client_id, from_fournisseur_id, to_fournisseur_id, points_to_transfer > 0',
        }),
        { status: 400 },
      )
    }

    if (from_fournisseur_id === to_fournisseur_id) {
      return new Response(
        JSON.stringify({
          error: 'Cannot transfer points to the same provider',
        }),
        { status: 400 },
      )
    }

    // 1. Verify both providers exist
    const { data: providers, error: providersError } = await supabase
      .from('fournisseurs')
      .select('id')
      .in('id', [from_fournisseur_id, to_fournisseur_id])

    if (providersError) {
      return new Response(JSON.stringify({ error: providersError.message }), { status: 500 })
    }

    if (!providers || providers.length !== 2) {
      return new Response(JSON.stringify({ error: 'One or both providers not found' }), {
        status: 404,
      })
    }

    // 2. Verify both providers are in same active coalition
    const { data: coalitionMembers, error: coalitionError } = await supabase
      .from('coalition_members')
      .select('coalition_id')
      .in('fournisseur_id', [from_fournisseur_id, to_fournisseur_id])
      .eq('status', 'active')

    if (coalitionError) {
      return new Response(JSON.stringify({ error: coalitionError.message }), { status: 500 })
    }

    if (!coalitionMembers || coalitionMembers.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'Providers not in same active coalition',
        }),
        { status: 400 },
      )
    }

    const coalitionIds = new Set(coalitionMembers.map((m) => m.coalition_id))
    if (coalitionIds.size !== 1) {
      return new Response(
        JSON.stringify({
          error: 'Providers not in same coalition',
        }),
        { status: 400 },
      )
    }

    const coalition_id = Array.from(coalitionIds)[0]

    // 3. Fetch coalition config
    const { data: coalition, error: coalitionDetailError } = await supabase
      .from('provider_coalitions')
      .select('conversion_rate, platform_fee_pct, is_active')
      .eq('id', coalition_id)
      .eq('is_active', true)
      .single()

    if (coalitionDetailError) {
      return new Response(JSON.stringify({ error: 'Coalition not found or inactive' }), {
        status: 404,
      })
    }

    // 4. Check client has enough points at source
    const { data: sourcePoints, error: sourceError } = await supabase
      .from('client_points')
      .select('solde')
      .eq('client_id', client_id)
      .eq('fournisseur_id', from_fournisseur_id)
      .single()

    if (sourceError && sourceError.code !== 'PGRST116') {
      return new Response(JSON.stringify({ error: sourceError.message }), { status: 500 })
    }

    const currentBalance = sourcePoints?.solde ?? 0
    if (currentBalance < points_to_transfer) {
      return new Response(
        JSON.stringify({
          error: `Insufficient points. You have ${currentBalance}, need ${points_to_transfer}`,
        }),
        { status: 400 },
      )
    }

    // 5. Calculate fees
    const platform_fee_points = Math.floor(points_to_transfer * (coalition.platform_fee_pct ?? 0.1))
    const points_after_fee = points_to_transfer - platform_fee_points
    const points_credited = Math.floor(
      points_after_fee * (coalition.conversion_rate ?? 1.0),
    )

    // 6. BEGIN atomic transaction
    // Deduct from source
    const { error: deductError } = await supabase
      .from('client_points')
      .update({
        solde: currentBalance - points_to_transfer,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', client_id)
      .eq('fournisseur_id', from_fournisseur_id)

    if (deductError) {
      return new Response(JSON.stringify({ error: 'Failed to deduct points from source' }), {
        status: 500,
      })
    }

    // 7. Credit to destination
    const { data: destPoints, error: destFetchError } = await supabase
      .from('client_points')
      .select('solde')
      .eq('client_id', client_id)
      .eq('fournisseur_id', to_fournisseur_id)
      .single()

    if (destFetchError && destFetchError.code !== 'PGRST116') {
      // Rollback
      await supabase
        .from('client_points')
        .update({ solde: currentBalance })
        .eq('client_id', client_id)
        .eq('fournisseur_id', from_fournisseur_id)

      return new Response(JSON.stringify({ error: 'Failed to fetch destination balance' }), {
        status: 500,
      })
    }

    const destBalance = destPoints?.solde ?? 0

    const { error: creditError } = await supabase
      .from('client_points')
      .upsert({
        client_id,
        fournisseur_id: to_fournisseur_id,
        solde: destBalance + points_credited,
        updated_at: new Date().toISOString(),
      })

    if (creditError) {
      // Rollback
      await supabase
        .from('client_points')
        .update({ solde: currentBalance })
        .eq('client_id', client_id)
        .eq('fournisseur_id', from_fournisseur_id)

      return new Response(JSON.stringify({ error: 'Failed to credit points to destination' }), {
        status: 500,
      })
    }

    // 8. Record transfer
    const { error: transferError } = await supabase.from('point_transfers').insert({
      client_id,
      from_fournisseur_id,
      to_fournisseur_id,
      coalition_id,
      points_deducted: points_to_transfer,
      points_credited,
      platform_fee_points,
      conversion_rate: coalition.conversion_rate ?? 1.0,
    })

    if (transferError) {
      // Rollback both
      await supabase
        .from('client_points')
        .update({ solde: currentBalance })
        .eq('client_id', client_id)
        .eq('fournisseur_id', from_fournisseur_id)

      await supabase
        .from('client_points')
        .update({ solde: destBalance })
        .eq('client_id', client_id)
        .eq('fournisseur_id', to_fournisseur_id)

      return new Response(JSON.stringify({ error: 'Failed to record transfer' }), { status: 500 })
    }

    // 9. Award XP + badges + challenges
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/award-xp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        client_id,
        xp_amount: 20,
        source: 'transfer',
      }),
    }).catch((e) => console.warn('Failed to award XP for transfer:', e))

    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/check-badges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        client_id,
        trigger_type: 'transfer_count',
      }),
    }).catch((e) => console.warn('Failed to check badges for transfer:', e))

    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/update-challenges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        client_id,
        event_type: 'transfer',
        value: 1,
      }),
    }).catch((e) => console.warn('Failed to update challenges for transfer:', e))

    // 10. Send notification
    try {
      await supabase.from('notifications').insert({
        user_id: client_id,
        type: 'transfer_completed',
        title: '💱 Points transférés!',
        body: `${points_credited} points transférés avec succès`,
        data: {
          from_points_deducted: points_to_transfer,
          to_points_credited: points_credited,
          platform_fee: platform_fee_points,
        },
      })
    } catch (notifError) {
      console.warn('Failed to send transfer notification:', notifError)
    }

    return new Response(
      JSON.stringify({
        points_deducted: points_to_transfer,
        platform_fee: platform_fee_points,
        points_credited,
        conversion_rate: coalition.conversion_rate ?? 1.0,
        from_new_balance: currentBalance - points_to_transfer,
        to_new_balance: destBalance + points_credited,
      } as TransferPointsResponse),
      { status: 200 },
    )
  } catch (error) {
    console.error('Unexpected error in transfer-points:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
