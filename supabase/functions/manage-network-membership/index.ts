import { createClient } from 'npm:@supabase/supabase-js@2'

type MembershipAction =
  | 'REQUEST_JOIN'
  | 'VALIDATE_MEMBER'
  | 'REJECT_MEMBER'
  | 'SUSPEND_MEMBER'
  | 'LEAVE_NETWORK'

type Body = {
  action?: MembershipAction
  network_id?: string
  fournisseur_id?: string
  membership_id?: string
  request_message?: string
  rejection_reason?: string
  suspension_reason?: string
  invite_code?: string
}

type NetworkRow = {
  id: string
  slug: string
  name: Record<string, string> | null
  is_active: boolean
  is_public: boolean
  membership_type: 'open' | 'validated' | 'invite_only'
  welcome_bonus_points: number
  provider_criteria: Record<string, unknown> | null
  allowed_countries: string[] | null
  allowed_categories: string[] | null
}

type ProviderRow = {
  id: string
  user_id: string
  tier: 'free' | 'starter' | 'premium' | 'enterprise'
  adresse: string | null
  nom_commerce: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIER_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  premium: 2,
  enterprise: 3,
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

function displayNetworkName(network: Pick<NetworkRow, 'name' | 'slug'>): string {
  return network.name?.fr ?? network.name?.en ?? network.slug
}

async function notifyAdmins(admin: ReturnType<typeof createClient>, title: string, body: string, data: Record<string, unknown>) {
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin')
  const rows = (admins ?? []).map((row) => ({
    user_id: row.id,
    title,
    body,
    type: 'network_membership_admin',
    data,
  }))

  if (rows.length > 0) {
    await admin.from('notifications').insert(rows)
  }
}

async function notifyUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
  type: string,
  data: Record<string, unknown>,
) {
  await admin.from('notifications').insert({
    user_id: userId,
    title,
    body,
    type,
    data,
  })
}

function extractCountryCodeFromAddress(address: string | null): string | null {
  if (!address) {
    return null
  }

  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length === 0) {
    return null
  }

  const tail = parts[parts.length - 1]
  return tail.length >= 2 ? tail.slice(0, 2).toUpperCase() : null
}

async function creditWelcomeBonusToProviderClients(params: {
  admin: ReturnType<typeof createClient>
  networkId: string
  fournisseurId: string
  bonusPoints: number
}) {
  const { admin, networkId, fournisseurId, bonusPoints } = params
  if (bonusPoints <= 0) {
    return
  }

  const { data: clientRows } = await admin
    .from('client_points')
    .select('client_id, solde')
    .eq('fournisseur_id', fournisseurId)

  for (const row of clientRows ?? []) {
    const clientId = String(row.client_id)
    const currentBalance = Number(row.solde ?? 0)

    await admin
      .from('client_points')
      .update({ solde: currentBalance + bonusPoints })
      .eq('client_id', clientId)
      .eq('fournisseur_id', fournisseurId)

    await admin
      .from('network_clients')
      .upsert(
        {
          network_id: networkId,
          client_id: clientId,
          total_network_points: bonusPoints,
          total_network_transactions: 1,
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: 'network_id,client_id' },
      )

    await admin.from('network_point_events').insert({
      network_id: networkId,
      client_id: clientId,
      fournisseur_id: fournisseurId,
      transaction_id: null,
      base_points: 0,
      bonus_points: bonusPoints,
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

  if (action === 'REQUEST_JOIN') {
    if (role !== 'fournisseur') {
      return json({ error: 'Only providers can request join' }, 403)
    }

    const networkId = String(body.network_id ?? '')
    if (!networkId) {
      return json({ error: 'network_id is required' }, 400)
    }

    const { data: provider, error: providerError } = await admin
      .from('fournisseurs')
      .select('id, user_id, tier, adresse, nom_commerce')
      .eq('user_id', userId)
      .maybeSingle<ProviderRow>()

    if (providerError || !provider?.id) {
      return json({ error: providerError?.message ?? 'Provider not found' }, 404)
    }

    const { data: network, error: networkError } = await admin
      .from('networks')
      .select('id, slug, name, is_active, is_public, membership_type, welcome_bonus_points, provider_criteria, allowed_countries, allowed_categories')
      .eq('id', networkId)
      .maybeSingle<NetworkRow>()

    if (networkError || !network?.id) {
      return json({ error: networkError?.message ?? 'Network not found' }, 404)
    }

    if (!network.is_active || !network.is_public) {
      return json({ error: 'Network unavailable' }, 400)
    }

    const { data: existingMembership } = await admin
      .from('network_members')
      .select('id, status')
      .eq('network_id', networkId)
      .eq('fournisseur_id', provider.id)
      .maybeSingle<{ id: string; status: string }>()

    if (existingMembership?.id && !['left', 'rejected'].includes(existingMembership.status)) {
      return json({ error: 'Already member or request already pending' }, 409)
    }

    const minTier = String((network.provider_criteria?.min_tier as string | undefined) ?? 'free')
    if (TIER_ORDER[provider.tier] < TIER_ORDER[minTier]) {
      return json({ error: 'Provider tier requirement not met' }, 400)
    }

    const minClients = Number((network.provider_criteria?.min_clients as number | undefined) ?? 0)
    const { count: clientCount } = await admin
      .from('client_points')
      .select('client_id', { count: 'exact', head: true })
      .eq('fournisseur_id', provider.id)

    if (minClients > 0 && Number(clientCount ?? 0) < minClients) {
      return json({ error: 'Provider client requirement not met' }, 400)
    }

    const providerCountry = extractCountryCodeFromAddress(provider.adresse)
    const allowedCountries = network.allowed_countries ?? null
    if (allowedCountries && allowedCountries.length > 0) {
      if (!providerCountry || !allowedCountries.map((value) => value.toUpperCase()).includes(providerCountry)) {
        return json({ error: 'Provider country requirement not met' }, 400)
      }
    }

    if (network.membership_type === 'invite_only') {
      const inviteCode = String(body.invite_code ?? '').trim()
      if (!inviteCode) {
        return json({ error: 'invite_code is required' }, 400)
      }

      const { data: invitation, error: inviteError } = await admin
        .from('network_invitations')
        .select('id, current_uses, max_uses, expires_at, is_active')
        .eq('network_id', networkId)
        .eq('invite_type', 'provider')
        .eq('invite_code', inviteCode)
        .maybeSingle<{
          id: string
          current_uses: number
          max_uses: number | null
          expires_at: string | null
          is_active: boolean
        }>()

      if (inviteError || !invitation?.id) {
        return json({ error: 'Invalid invite code' }, 400)
      }

      if (!invitation.is_active) {
        return json({ error: 'Invite code inactive' }, 400)
      }

      if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
        return json({ error: 'Invite code expired' }, 400)
      }

      if (invitation.max_uses !== null && invitation.current_uses >= invitation.max_uses) {
        return json({ error: 'Invite code exhausted' }, 400)
      }

      await admin
        .from('network_invitations')
        .update({ current_uses: invitation.current_uses + 1 })
        .eq('id', invitation.id)

      await admin.from('network_members').upsert(
        {
          network_id: networkId,
          fournisseur_id: provider.id,
          status: 'active',
          request_message: body.request_message ?? null,
          invite_code: inviteCode,
          joined_at: new Date().toISOString(),
          validated_by: null,
        },
        { onConflict: 'network_id,fournisseur_id' },
      )

      await creditWelcomeBonusToProviderClients({
        admin,
        networkId,
        fournisseurId: provider.id,
        bonusPoints: Number(network.welcome_bonus_points ?? 0),
      })

      await notifyAdmins(
        admin,
        '🤝 Nouveau membre réseau',
        `${provider.nom_commerce} a rejoint ${displayNetworkName(network)}.`,
        { network_id: networkId, fournisseur_id: provider.id },
      )

      return json({ status: 'active', message: 'Joined with invitation code' })
    }

    if (network.membership_type === 'open') {
      await admin.from('network_members').upsert(
        {
          network_id: networkId,
          fournisseur_id: provider.id,
          status: 'active',
          request_message: body.request_message ?? null,
          joined_at: new Date().toISOString(),
          validated_by: null,
        },
        { onConflict: 'network_id,fournisseur_id' },
      )

      await creditWelcomeBonusToProviderClients({
        admin,
        networkId,
        fournisseurId: provider.id,
        bonusPoints: Number(network.welcome_bonus_points ?? 0),
      })

      await notifyAdmins(
        admin,
        '🤝 Nouveau membre réseau',
        `${provider.nom_commerce} a rejoint ${displayNetworkName(network)}.`,
        { network_id: networkId, fournisseur_id: provider.id },
      )

      return json({ status: 'active', message: 'Provider joined network' })
    }

    await admin.from('network_members').upsert(
      {
        network_id: networkId,
        fournisseur_id: provider.id,
        status: 'pending',
        request_message: body.request_message ?? null,
      },
      { onConflict: 'network_id,fournisseur_id' },
    )

    await notifyAdmins(
      admin,
      '📝 Demande d’adhésion réseau',
      `${provider.nom_commerce} demande à rejoindre ${displayNetworkName(network)}.`,
      { network_id: networkId, fournisseur_id: provider.id },
    )

    await notifyUser(
      admin,
      provider.user_id,
      '⏳ Demande envoyée',
      `Votre demande pour ${displayNetworkName(network)} est en attente de validation.`,
      'membership_pending',
      { network_id: networkId },
    )

    return json({ status: 'pending', message: 'Demande envoyée, en attente de validation' })
  }

  if (action === 'VALIDATE_MEMBER') {
    if (role !== 'admin') {
      return json({ error: 'Admin only' }, 403)
    }

    const membershipId = String(body.membership_id ?? '')
    const networkId = String(body.network_id ?? '')
    const fournisseurId = String(body.fournisseur_id ?? '')

    let query = admin
      .from('network_members')
      .select('id, network_id, fournisseur_id, status, networks(id, slug, name, welcome_bonus_points), fournisseurs(user_id, nom_commerce)')

    if (membershipId) {
      query = query.eq('id', membershipId)
    } else {
      if (!networkId || !fournisseurId) {
        return json({ error: 'membership_id or (network_id and fournisseur_id) are required' }, 400)
      }
      query = query.eq('network_id', networkId).eq('fournisseur_id', fournisseurId)
    }

    const { data: membership, error: membershipError } = await query.maybeSingle<{
      id: string
      network_id: string
      fournisseur_id: string
      status: string
      networks: NetworkRow | NetworkRow[] | null
      fournisseurs: ProviderRow | ProviderRow[] | null
    }>()

    if (membershipError || !membership?.id) {
      return json({ error: membershipError?.message ?? 'Membership not found' }, 404)
    }

    const network = Array.isArray(membership.networks) ? membership.networks[0] : membership.networks
    const provider = Array.isArray(membership.fournisseurs) ? membership.fournisseurs[0] : membership.fournisseurs

    if (!network || !provider) {
      return json({ error: 'Membership relations unavailable' }, 400)
    }

    await admin
      .from('network_members')
      .update({
        status: 'active',
        joined_at: new Date().toISOString(),
        validated_by: userId,
        rejection_reason: null,
        suspended_at: null,
        suspension_reason: null,
      })
      .eq('id', membership.id)

    await creditWelcomeBonusToProviderClients({
      admin,
      networkId: membership.network_id,
      fournisseurId: membership.fournisseur_id,
      bonusPoints: Number(network.welcome_bonus_points ?? 0),
    })

    await notifyUser(
      admin,
      provider.user_id,
      '🎉 Demande acceptée',
      `Votre demande pour ${displayNetworkName(network)} a été acceptée!`,
      'membership_validated',
      { network_id: membership.network_id },
    )

    const { data: enrolledClients } = await admin
      .from('network_clients')
      .select('client_id')
      .eq('network_id', membership.network_id)

    const providerName = provider.nom_commerce ?? 'Un commerce'
    const announcementRows = (enrolledClients ?? []).map((row) => ({
      user_id: row.client_id,
      title: '🆕 Nouveau membre réseau',
      body: `${providerName} a rejoint le réseau ${displayNetworkName(network)}!`,
      type: 'new_network_member',
      data: { network_id: membership.network_id, fournisseur_id: membership.fournisseur_id },
    }))

    if (announcementRows.length > 0) {
      await admin.from('notifications').insert(announcementRows)
    }

    return json({ success: true })
  }

  if (action === 'REJECT_MEMBER') {
    if (role !== 'admin') {
      return json({ error: 'Admin only' }, 403)
    }

    const membershipId = String(body.membership_id ?? '')
    const reason = String(body.rejection_reason ?? '').trim()

    if (!membershipId) {
      return json({ error: 'membership_id is required' }, 400)
    }

    const { data: membership } = await admin
      .from('network_members')
      .select('id, network_id, fournisseur_id, networks(slug, name), fournisseurs(user_id)')
      .eq('id', membershipId)
      .maybeSingle<{
        id: string
        network_id: string
        fournisseur_id: string
        networks: Pick<NetworkRow, 'slug' | 'name'> | Pick<NetworkRow, 'slug' | 'name'>[] | null
        fournisseurs: Pick<ProviderRow, 'user_id'> | Pick<ProviderRow, 'user_id'>[] | null
      }>()

    if (!membership?.id) {
      return json({ error: 'Membership not found' }, 404)
    }

    await admin
      .from('network_members')
      .update({ status: 'rejected', rejection_reason: reason || null })
      .eq('id', membershipId)

    const network = Array.isArray(membership.networks) ? membership.networks[0] : membership.networks
    const provider = Array.isArray(membership.fournisseurs) ? membership.fournisseurs[0] : membership.fournisseurs

    if (provider?.user_id && network) {
      await notifyUser(
        admin,
        provider.user_id,
        '❌ Demande refusée',
        reason
          ? `${displayNetworkName(network)}: ${reason}`
          : `Votre demande pour ${displayNetworkName(network)} n'a pas été retenue.`,
        'membership_rejected',
        { network_id: membership.network_id },
      )
    }

    return json({ success: true })
  }

  if (action === 'SUSPEND_MEMBER') {
    if (role !== 'admin') {
      return json({ error: 'Admin only' }, 403)
    }

    const membershipId = String(body.membership_id ?? '')
    const reason = String(body.suspension_reason ?? '').trim()

    if (!membershipId) {
      return json({ error: 'membership_id is required' }, 400)
    }

    const { data: membership } = await admin
      .from('network_members')
      .select('id, network_id, fournisseurs(user_id)')
      .eq('id', membershipId)
      .maybeSingle<{
        id: string
        network_id: string
        fournisseurs: Pick<ProviderRow, 'user_id'> | Pick<ProviderRow, 'user_id'>[] | null
      }>()

    if (!membership?.id) {
      return json({ error: 'Membership not found' }, 404)
    }

    await admin
      .from('network_members')
      .update({
        status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspension_reason: reason || null,
      })
      .eq('id', membershipId)

    const provider = Array.isArray(membership.fournisseurs) ? membership.fournisseurs[0] : membership.fournisseurs
    if (provider?.user_id) {
      await notifyUser(
        admin,
        provider.user_id,
        '⛔ Adhésion suspendue',
        reason || 'Votre adhésion réseau a été suspendue.',
        'membership_suspended',
        { network_id: membership.network_id },
      )
    }

    return json({ success: true })
  }

  if (action === 'LEAVE_NETWORK') {
    if (role !== 'fournisseur') {
      return json({ error: 'Provider only' }, 403)
    }

    const networkId = String(body.network_id ?? '')
    if (!networkId) {
      return json({ error: 'network_id is required' }, 400)
    }

    const { data: provider } = await admin
      .from('fournisseurs')
      .select('id, user_id, nom_commerce')
      .eq('user_id', userId)
      .maybeSingle<Pick<ProviderRow, 'id' | 'user_id' | 'nom_commerce'>>()

    if (!provider?.id) {
      return json({ error: 'Provider not found' }, 404)
    }

    const { data: network } = await admin
      .from('networks')
      .select('slug, name')
      .eq('id', networkId)
      .maybeSingle<Pick<NetworkRow, 'slug' | 'name'>>()

    await admin
      .from('network_members')
      .update({ status: 'left', left_at: new Date().toISOString() })
      .eq('network_id', networkId)
      .eq('fournisseur_id', provider.id)

    await notifyAdmins(
      admin,
      '👋 Membre sorti du réseau',
      `${provider.nom_commerce} a quitté ${network ? displayNetworkName(network) : 'le réseau'}.`,
      { network_id: networkId, fournisseur_id: provider.id },
    )

    return json({ success: true })
  }

  return json({ error: `Unsupported action: ${action}` }, 400)
})
