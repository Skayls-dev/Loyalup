import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CreditPointsRequest = {
  pending_transaction_id?: string
  service_id?: string | null
  montant?: number
}

type ComputeNetworkBonusRow = {
  network_id: string
  network_name: string
  bonus_points: number
  multiplier: number
}

type NetworkDetailRow = {
  id: string
  emoji: string | null
  multiplier_mode: 'additive' | 'compound'
}

type ResolvedNetworkBonus = {
  network_id: string
  network_name: string
  emoji: string
  multiplier: number
  multiplier_mode: 'additive' | 'compound'
  bonus_points: number
}

const toAbbreviation = (value: string): string => {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length === 0) {
    return 'NET'
  }

  return parts
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const safeFloor = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }

  return Math.floor(value)
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
    const payload = (await req.json().catch(() => ({}))) as CreditPointsRequest

    if (!payload.pending_transaction_id || typeof payload.montant !== 'number') {
      return new Response(JSON.stringify({ error: 'pending_transaction_id and montant are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (payload.montant <= 0) {
      return new Response(JSON.stringify({ error: 'montant must be > 0' }), {
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

    const { data: fournisseurData, error: fournisseurError } = await adminClient
      .from('fournisseurs')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (fournisseurError) {
      return new Response(JSON.stringify({ error: fournisseurError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!fournisseurData?.id) {
      return new Response(JSON.stringify({ error: 'Provider profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rpcData, error: rpcError } = await adminClient.rpc('credit_points_transaction', {
      p_provider_user_id: userData.user.id,
      p_pending_transaction_id: payload.pending_transaction_id,
      p_montant: payload.montant,
      p_service_id: payload.service_id ?? null,
    })

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = Array.isArray(rpcData) ? rpcData[0] : null

    if (!result?.success) {
      return new Response(JSON.stringify({ error: 'Credit points transaction failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: transactionData, error: transactionError } = await adminClient
      .from('transactions')
      .select('client_id, fournisseur_id')
      .eq('id', result.transaction_id)
      .maybeSingle()

    if (transactionError || !transactionData?.client_id || !transactionData?.fournisseur_id) {
      return new Response(JSON.stringify({ error: 'Unable to resolve transaction participant for rewards' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const basePoints = Number(result.points_credited ?? 0)

    const { data: rawNetworkBonuses, error: networkBonusError } = await adminClient.rpc('compute_network_bonus', {
      p_fournisseur_id: transactionData.fournisseur_id,
      p_base_points: basePoints,
    })

    if (networkBonusError) {
      return new Response(JSON.stringify({ error: networkBonusError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const networkBonusRows = (Array.isArray(rawNetworkBonuses)
      ? rawNetworkBonuses
      : []) as ComputeNetworkBonusRow[]

    const networkIds = networkBonusRows.map((row) => row.network_id)

    const networkDetailsById = new Map<string, NetworkDetailRow>()

    if (networkIds.length > 0) {
      const { data: networkDetails, error: networkDetailsError } = await adminClient
        .from('networks')
        .select('id, emoji, multiplier_mode')
        .in('id', networkIds)

      if (networkDetailsError) {
        return new Response(JSON.stringify({ error: networkDetailsError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      for (const detail of (networkDetails ?? []) as NetworkDetailRow[]) {
        networkDetailsById.set(detail.id, detail)
      }
    }

    const resolvedBonuses: ResolvedNetworkBonus[] = networkBonusRows
      .map((row) => {
        const detail = networkDetailsById.get(row.network_id)
        const mode = detail?.multiplier_mode ?? 'additive'

        return {
          network_id: row.network_id,
          network_name: row.network_name,
          emoji: detail?.emoji ?? '✨',
          multiplier: Number(row.multiplier ?? 1),
          multiplier_mode: mode,
          bonus_points: safeFloor(Number(row.bonus_points ?? 0)),
        }
      })
      .filter((entry) => entry.multiplier > 1)

    let additiveBoost = 0
    let compoundFactor = 1

    for (const bonus of resolvedBonuses) {
      if (bonus.multiplier_mode === 'compound') {
        compoundFactor *= bonus.multiplier
      } else {
        additiveBoost += bonus.multiplier - 1
      }
    }

    const totalMultiplier = resolvedBonuses.length > 0 ? (1 + additiveBoost) * compoundFactor : 1
    const totalPoints = safeFloor(basePoints * totalMultiplier)
    const expectedBonusTotal = Math.max(totalPoints - basePoints, 0)

    const distributedBaseBonus = resolvedBonuses.reduce((sum, item) => sum + item.bonus_points, 0)
    const bonusDelta = expectedBonusTotal - distributedBaseBonus

    if (bonusDelta !== 0 && resolvedBonuses.length > 0) {
      resolvedBonuses.sort((a, b) => b.multiplier - a.multiplier)
      resolvedBonuses[0].bonus_points = Math.max(0, resolvedBonuses[0].bonus_points + bonusDelta)
    }

    const finalBonusTotal = resolvedBonuses.reduce((sum, item) => sum + item.bonus_points, 0)
    const additionalPoints = Math.max(finalBonusTotal, 0)

    let adjustedBalance = Number(result.new_balance ?? 0)

    if (additionalPoints > 0) {
      const { error: txUpdateError } = await adminClient
        .from('transactions')
        .update({ points_credited: basePoints + additionalPoints })
        .eq('id', result.transaction_id)

      if (txUpdateError) {
        return new Response(JSON.stringify({ error: txUpdateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: clientPointsError } = await adminClient
        .from('client_points')
        .update({ solde: adjustedBalance + additionalPoints })
        .eq('client_id', transactionData.client_id)
        .eq('fournisseur_id', transactionData.fournisseur_id)

      if (clientPointsError) {
        return new Response(JSON.stringify({ error: clientPointsError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      adjustedBalance += additionalPoints

      for (const bonus of resolvedBonuses) {
        if (bonus.bonus_points <= 0) {
          continue
        }

        const { error: eventInsertError } = await adminClient.from('network_point_events').insert({
          network_id: bonus.network_id,
          client_id: transactionData.client_id,
          fournisseur_id: transactionData.fournisseur_id,
          transaction_id: result.transaction_id,
          base_points: basePoints,
          bonus_points: bonus.bonus_points,
          multiplier_applied: bonus.multiplier,
        })

        if (eventInsertError) {
          return new Response(JSON.stringify({ error: eventInsertError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { error: enrollmentUpsertError } = await adminClient.from('network_clients').upsert(
          {
            network_id: bonus.network_id,
            client_id: transactionData.client_id,
            total_network_points: 0,
            total_network_transactions: 0,
            last_activity_at: new Date().toISOString(),
          },
          {
            onConflict: 'network_id,client_id',
            ignoreDuplicates: false,
          },
        )

        if (enrollmentUpsertError) {
          return new Response(JSON.stringify({ error: enrollmentUpsertError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: enrollmentRow, error: enrollmentSelectError } = await adminClient
          .from('network_clients')
          .select('total_network_points, total_network_transactions')
          .eq('network_id', bonus.network_id)
          .eq('client_id', transactionData.client_id)
          .maybeSingle()

        if (enrollmentSelectError) {
          return new Response(JSON.stringify({ error: enrollmentSelectError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const currentNetworkPoints = Number(enrollmentRow?.total_network_points ?? 0)
        const currentNetworkTransactions = Number(enrollmentRow?.total_network_transactions ?? 0)

        const { error: enrollmentIncrementError } = await adminClient
          .from('network_clients')
          .update({
            total_network_points: currentNetworkPoints + bonus.bonus_points,
            total_network_transactions: currentNetworkTransactions + 1,
            last_activity_at: new Date().toISOString(),
          })
          .eq('network_id', bonus.network_id)
          .eq('client_id', transactionData.client_id)

        if (enrollmentIncrementError) {
          return new Response(JSON.stringify({ error: enrollmentIncrementError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      const { data: providerRow } = await adminClient
        .from('fournisseurs')
        .select('nom_commerce')
        .eq('id', transactionData.fournisseur_id)
        .maybeSingle()

      const providerName = providerRow?.nom_commerce ?? 'Commerce'
      const breakdown = resolvedBonuses
        .filter((entry) => entry.bonus_points > 0)
        .map((entry) => `${entry.emoji} ${toAbbreviation(entry.network_name)} +${entry.bonus_points}`)
        .join(' · ')

      await adminClient
        .from('notifications')
        .insert({
          user_id: transactionData.client_id,
          type: 'network_bonus',
          title: `✨ Bonus réseau`,
          body: `${providerName} · +${basePoints + additionalPoints} pts${breakdown ? `\n${breakdown}` : ''}`,
          data: {
            transaction_id: result.transaction_id,
            base_points: basePoints,
            total_points: basePoints + additionalPoints,
            network_bonuses: resolvedBonuses.map((entry) => ({
              network_id: entry.network_id,
              network_name: entry.network_name,
              emoji: entry.emoji,
              bonus: entry.bonus_points,
            })),
          },
        })
        .catch((error) => {
          console.warn('Failed to insert network bonus notification', error)
        })
    }

    const { error: rewardsError } = await adminClient.rpc('check_and_unlock_rewards', {
      p_client_id: transactionData.client_id,
      p_fournisseur_id: transactionData.fournisseur_id,
    })

    if (rewardsError) {
      return new Response(JSON.stringify({ error: rewardsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        base_points: basePoints,
        points_credited: basePoints + additionalPoints,
        network_bonuses: resolvedBonuses
          .filter((entry) => entry.bonus_points > 0)
          .map((entry) => ({
            network_name: entry.network_name,
            emoji: entry.emoji,
            bonus: entry.bonus_points,
          })),
        total_points: basePoints + additionalPoints,
        new_balance: adjustedBalance,
        transaction_id: result.transaction_id,
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
