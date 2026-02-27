import { createClient } from 'npm:@supabase/supabase-js@2'

type Action = 'ENROLL_CLIENT' | 'UNENROLL_CLIENT' | 'GET_ELIGIBLE_NETWORKS'

type Body = {
  action?: Action
  network_id?: string
  client_invite_code?: string
}

type NetworkRow = {
  id: string
  slug: string
  name: Record<string, string> | null
  is_active: boolean
  is_public: boolean
  is_draft: boolean
  client_access: 'open' | 'invite' | 'level_required' | 'provider_only'
  min_level_required: number
  max_clients: number | null
  client_invite_code: string | null
  welcome_bonus_points: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function displayNetworkName(network: Pick<NetworkRow, 'name' | 'slug'>): string {
  return network.name?.fr ?? network.name?.en ?? network.slug
}

async function getContext(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: json({ error: 'Missing env vars' }, 500), admin: null, userId: null, role: null }
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null, userId: null, role: null }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: userResult, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userResult.user?.id) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null, userId: null, role: null }
  }

  const userId = userResult.user.id

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<{ role: 'client' | 'fournisseur' | 'admin' }>()

  if (profileError || !profile?.role) {
    return { error: json({ error: 'Forbidden' }, 403), admin: null, userId: null, role: null }
  }

  return { error: null, admin, userId, role: profile.role }
}

async function awardNetworkJoinerBadge(params: {
  admin: ReturnType<typeof createClient>
  clientId: string
  network: Pick<NetworkRow, 'slug'>
}) {
  const { admin, clientId, network } = params

  const preferredCode = `network_joiner_${network.slug}`
  const fallbackCode = 'network_joiner'

  const { data: badge } = await admin
    .from('badge_definitions')
    .select('id')
    .in('code', [preferredCode, fallbackCode])
    .eq('is_active', true)
    .order('code', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (!badge?.id) {
    return
  }

  await admin
    .from('client_badges')
    .upsert({ client_id: clientId, badge_id: badge.id }, { onConflict: 'client_id,badge_id' })
}

async function creditWelcomeBonusToClient(params: {
  admin: ReturnType<typeof createClient>
  clientId: string
  networkId: string
  welcomeBonus: number
}) {
  const { admin, clientId, networkId, welcomeBonus } = params
  if (welcomeBonus <= 0) {
    return
  }

  const { data: memberProviders } = await admin
    .from('network_members')
    .select('fournisseur_id')
    .eq('network_id', networkId)
    .eq('status', 'active')

  const providerIds = (memberProviders ?? []).map((row) => row.fournisseur_id as string).filter(Boolean)
  if (providerIds.length === 0) {
    return
  }

  const { data: clientPointsRows } = await admin
    .from('client_points')
    .select('fournisseur_id, solde')
    .eq('client_id', clientId)
    .in('fournisseur_id', providerIds)

  for (const row of clientPointsRows ?? []) {
    const fournisseurId = String(row.fournisseur_id)
    const currentBalance = Number(row.solde ?? 0)

    await admin
      .from('client_points')
      .update({ solde: currentBalance + welcomeBonus })
      .eq('client_id', clientId)
      .eq('fournisseur_id', fournisseurId)

    await admin.from('network_point_events').insert({
      network_id: networkId,
      client_id: clientId,
      fournisseur_id: fournisseurId,
      transaction_id: null,
      base_points: 0,
      bonus_points: welcomeBonus,
      multiplier_applied: 1,
    })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const context = await getContext(req)
  if (context.error || !context.admin || !context.userId || !context.role) {
    return context.error ?? json({ error: 'Unauthorized' }, 401)
  }

  const { admin, userId, role } = context

  if (role !== 'client') {
    return json({ error: 'Client only' }, 403)
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const action = body.action
  if (!action) {
    return json({ error: 'Missing action' }, 400)
  }

  if (action === 'ENROLL_CLIENT') {
    const networkId = String(body.network_id ?? '')
    if (!networkId) {
      return json({ error: 'network_id is required' }, 400)
    }

    const { data: network, error: networkError } = await admin
      .from('networks')
      .select('id, slug, name, is_active, is_public, is_draft, client_access, min_level_required, max_clients, client_invite_code, welcome_bonus_points')
      .eq('id', networkId)
      .maybeSingle<NetworkRow>()

    if (networkError || !network?.id) {
      return json({ error: networkError?.message ?? 'Network not found' }, 404)
    }

    if (!network.is_active || !network.is_public || network.is_draft) {
      return json({ error: 'Network unavailable' }, 400)
    }

    const { data: existingMembership } = await admin
      .from('network_clients')
      .select('id')
      .eq('network_id', networkId)
      .eq('client_id', userId)
      .maybeSingle<{ id: string }>()

    if (existingMembership?.id) {
      return json({ error: 'Already enrolled' }, 409)
    }

    if (network.max_clients !== null) {
      const { count: enrolledCount } = await admin
        .from('network_clients')
        .select('id', { count: 'exact', head: true })
        .eq('network_id', networkId)

      if (Number(enrolledCount ?? 0) >= Number(network.max_clients)) {
        return json({ error: 'Network max clients reached' }, 400)
      }
    }

    if (network.client_access === 'invite') {
      const providedCode = String(body.client_invite_code ?? '').trim()
      if (!providedCode) {
        return json({ error: 'client_invite_code is required' }, 400)
      }

      let validated = false

      if (network.client_invite_code && network.client_invite_code.toLowerCase() === providedCode.toLowerCase()) {
        validated = true
      } else {
        const { data: invitation } = await admin
          .from('network_invitations')
          .select('id, current_uses, max_uses, expires_at, is_active')
          .eq('network_id', networkId)
          .eq('invite_type', 'client')
          .eq('invite_code', providedCode)
          .maybeSingle<{
            id: string
            current_uses: number
            max_uses: number | null
            expires_at: string | null
            is_active: boolean
          }>()

        if (invitation?.id && invitation.is_active) {
          const notExpired = !invitation.expires_at || new Date(invitation.expires_at).getTime() > Date.now()
          const hasRemainingUses = invitation.max_uses === null || invitation.current_uses < invitation.max_uses

          if (notExpired && hasRemainingUses) {
            validated = true
            await admin
              .from('network_invitations')
              .update({ current_uses: invitation.current_uses + 1 })
              .eq('id', invitation.id)
          }
        }
      }

      if (!validated) {
        return json({ error: 'Invalid invite code' }, 400)
      }
    }

    if (network.client_access === 'level_required') {
      const { data: level } = await admin
        .from('client_levels')
        .select('current_level')
        .eq('client_id', userId)
        .maybeSingle<{ current_level: number }>()

      const currentLevel = Number(level?.current_level ?? 1)
      if (currentLevel < Number(network.min_level_required ?? 1)) {
        return json({ error: 'LEVEL_TOO_LOW' }, 400)
      }
    }

    if (network.client_access === 'provider_only') {
      const { data: providerMemberships } = await admin
        .from('network_members')
        .select('fournisseur_id')
        .eq('network_id', networkId)
        .eq('status', 'active')

      const providerIds = (providerMemberships ?? []).map((row) => row.fournisseur_id as string).filter(Boolean)

      if (providerIds.length === 0) {
        return json({ error: 'No active providers in this network' }, 400)
      }

      const { data: clientProviderLinks } = await admin
        .from('client_points')
        .select('id')
        .eq('client_id', userId)
        .in('fournisseur_id', providerIds)
        .limit(1)

      if (!clientProviderLinks || clientProviderLinks.length === 0) {
        return json({ error: 'Client is not linked to any provider in this network' }, 400)
      }
    }

    const { error: enrollError } = await admin.from('network_clients').insert({
      network_id: networkId,
      client_id: userId,
      total_network_points: 0,
      total_network_transactions: 0,
      joined_at: new Date().toISOString(),
    })

    if (enrollError) {
      return json({ error: enrollError.message }, 500)
    }

    const welcomeBonus = Number(network.welcome_bonus_points ?? 0)

    await creditWelcomeBonusToClient({
      admin,
      clientId: userId,
      networkId,
      welcomeBonus,
    })

    if (welcomeBonus > 0) {
      await admin
        .from('network_clients')
        .update({ total_network_points: welcomeBonus, total_network_transactions: 1, last_activity_at: new Date().toISOString() })
        .eq('network_id', networkId)
        .eq('client_id', userId)
    }

    await awardNetworkJoinerBadge({
      admin,
      clientId: userId,
      network,
    })

    await admin.from('notifications').insert({
      user_id: userId,
      type: 'network_joined',
      title: '🎉 Bienvenue dans un réseau',
      body: `Bienvenue dans ${displayNetworkName(network)}! +${welcomeBonus} pts offerts`,
      data: {
        network_id: networkId,
        welcome_bonus_awarded: welcomeBonus,
      },
    })

    return json({ success: true, welcome_bonus_awarded: welcomeBonus })
  }

  if (action === 'UNENROLL_CLIENT') {
    const networkId = String(body.network_id ?? '')
    if (!networkId) {
      return json({ error: 'network_id is required' }, 400)
    }

    const { error: deleteError } = await admin
      .from('network_clients')
      .delete()
      .eq('network_id', networkId)
      .eq('client_id', userId)

    if (deleteError) {
      return json({ error: deleteError.message }, 500)
    }

    return json({ success: true })
  }

  if (action === 'GET_ELIGIBLE_NETWORKS') {
    const { data: networks, error: networksError } = await admin
      .from('networks')
      .select('id, slug, name, is_active, is_public, is_draft, client_access, min_level_required, max_clients, client_invite_code, welcome_bonus_points, member_count, client_count, coalition_enabled, category, tags, points_multiplier, is_featured')
      .eq('is_active', true)
      .eq('is_public', true)
      .eq('is_draft', false)

    if (networksError) {
      return json({ error: networksError.message }, 500)
    }

    const { data: myEnrollments } = await admin
      .from('network_clients')
      .select('network_id')
      .eq('client_id', userId)

    const enrolledSet = new Set((myEnrollments ?? []).map((row) => row.network_id as string))

    const { data: myClientLevels } = await admin
      .from('client_levels')
      .select('current_level')
      .eq('client_id', userId)
      .maybeSingle<{ current_level: number }>()

    const currentLevel = Number(myClientLevels?.current_level ?? 1)

    const { data: myProviderLinks } = await admin
      .from('client_points')
      .select('fournisseur_id')
      .eq('client_id', userId)

    const myProviderSet = new Set((myProviderLinks ?? []).map((row) => row.fournisseur_id as string))

    const networkIds = (networks ?? []).map((row) => String((row as Record<string, unknown>).id))

    const { data: allMembers } = networkIds.length
      ? await admin
          .from('network_members')
          .select('network_id, fournisseur_id')
          .in('network_id', networkIds)
          .eq('status', 'active')
      : { data: [] as Array<{ network_id: string; fournisseur_id: string }> }

    const providersByNetwork = new Map<string, string[]>()
    for (const member of allMembers ?? []) {
      const networkId = String(member.network_id)
      const arr = providersByNetwork.get(networkId) ?? []
      arr.push(String(member.fournisseur_id))
      providersByNetwork.set(networkId, arr)
    }

    const responseNetworks = (networks ?? []).map((row) => {
      const network = row as Record<string, unknown>
      const networkId = String(network.id)
      const clientAccess = String(network.client_access)
      const minLevel = Number(network.min_level_required ?? 1)
      const maxClients = network.max_clients === null ? null : Number(network.max_clients)
      const enrolled = enrolledSet.has(networkId)

      const providers = providersByNetwork.get(networkId) ?? []
      const linkedProvidersCount = providers.filter((providerId) => myProviderSet.has(providerId)).length

      let eligible = true
      let reason: string | null = null

      if (enrolled) {
        eligible = false
        reason = 'already_enrolled'
      } else if (clientAccess === 'invite') {
        eligible = false
        reason = 'invite_required'
      } else if (clientAccess === 'level_required' && currentLevel < minLevel) {
        eligible = false
        reason = 'level_required'
      } else if (clientAccess === 'provider_only' && linkedProvidersCount === 0) {
        eligible = false
        reason = 'provider_only'
      } else if (maxClients !== null && Number(network.client_count ?? 0) >= maxClients) {
        eligible = false
        reason = 'max_clients_reached'
      }

      return {
        ...network,
        is_member: enrolled,
        eligibility: {
          eligible,
          reason,
          linked_provider_count: linkedProvidersCount,
          current_level: currentLevel,
          min_level_required: minLevel,
        },
      }
    })

    return json({ networks: responseNetworks })
  }

  return json({ error: `Unsupported action: ${action}` }, 400)
})
