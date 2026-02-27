import { supabase } from '../../../shared/lib/supabaseClient'
import type {
  Network,
  NetworkAnnouncement,
  NetworkFilters,
  NetworkLeaderboardEntry,
  NetworkMember,
  NetworkStats,
  NetworkWithEligibility,
} from '../types/networkTypes'

type NetworkRow = Partial<Network> & {
  id: string
  slug: string
  name: Record<string, string>
}

type ProviderMembershipRow = {
  network_id: string
  status: string
  networks: NetworkRow | NetworkRow[] | null
}

type ClientEnrollmentRow = {
  network_id: string
  total_network_points: number
  last_activity_at: string | null
  networks: NetworkRow | NetworkRow[] | null
}

function normalizeNetwork(row: NetworkRow): Network {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    tagline: row.tagline ?? null,
    emoji: row.emoji ?? '✨',
    primary_color: row.primary_color ?? '#4EA8DE',
    secondary_color: row.secondary_color ?? null,
    category: (row.category ?? 'custom') as Network['category'],
    tags: row.tags ?? [],
    points_multiplier: Number(row.points_multiplier ?? 1),
    membership_type: (row.membership_type ?? 'validated') as Network['membership_type'],
    coalition_enabled: Boolean(row.coalition_enabled ?? false),
    transfer_rate: Number(row.transfer_rate ?? 1),
    platform_fee_pct: Number(row.platform_fee_pct ?? 0.1),
    welcome_bonus_points: Number(row.welcome_bonus_points ?? 0),
    client_access: (row.client_access ?? 'open') as Network['client_access'],
    min_level_required: Number(row.min_level_required ?? 1),
    is_public: Boolean(row.is_public ?? true),
    is_featured: Boolean(row.is_featured ?? false),
    show_member_map: Boolean(row.show_member_map ?? true),
    show_leaderboard: Boolean(row.show_leaderboard ?? true),
    is_active: Boolean(row.is_active ?? true),
    is_draft: Boolean(row.is_draft ?? false),
    member_count: Number(row.member_count ?? 0),
    client_count: Number(row.client_count ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }
}

async function getCurrentProviderId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return null
  }

  const { data: provider } = await supabase.from('fournisseurs').select('id').eq('user_id', user.id).maybeSingle<{ id: string }>()
  return provider?.id ?? null
}

async function getCurrentUserRole(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>()

  if (error) {
    return null
  }

  return data?.role ?? null
}

export async function getAllNetworks(filters?: NetworkFilters): Promise<NetworkWithEligibility[]> {
  let query = supabase
    .from('networks')
    .select('*')
    .eq('is_active', true)
    .eq('is_public', true)
    .eq('is_draft', false)

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (typeof filters?.hasCoalition === 'boolean') {
    query = query.eq('coalition_enabled', filters.hasCoalition)
  }

  if (typeof filters?.featured === 'boolean') {
    query = query.eq('is_featured', filters.featured)
  }

  const { data, error } = await query.order('is_featured', { ascending: false }).order('member_count', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const networkRows = (data ?? []) as NetworkRow[]

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const myEnrollments = new Set<string>()

  if (user?.id) {
    const { data: enrolledRows } = await supabase
      .from('network_clients')
      .select('network_id')
      .eq('client_id', user.id)

    for (const row of enrolledRows ?? []) {
      myEnrollments.add(String(row.network_id))
    }
  }

  return networkRows.map((row) => ({
    ...normalizeNetwork(row),
    is_member: myEnrollments.has(row.id),
  }))
}

export async function getNetworkBySlug(slug: string): Promise<{
  network: Network
  members: NetworkMember[]
  announcements: NetworkAnnouncement[]
  challenges: Array<Record<string, unknown>>
}> {
  const { data: network, error } = await supabase.from('networks').select('*').eq('slug', slug).maybeSingle<NetworkRow>()

  if (error) {
    throw new Error(error.message)
  }

  if (!network) {
    throw new Error('Network not found')
  }

  const [members, announcements] = await Promise.all([
    getNetworkMembers(network.id),
    getAnnouncementsForNetwork(network.id),
  ])

  return {
    network: normalizeNetwork(network),
    members,
    announcements,
    challenges: [],
  }
}

export async function getNetworkMembers(
  network_id: string,
  params?: { page?: number; pageSize?: number },
): Promise<NetworkMember[]> {
  const page = Math.max(1, Number(params?.page ?? 1))
  const pageSize = Math.max(1, Math.min(50, Number(params?.pageSize ?? 20)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error } = await supabase
    .from('network_members')
    .select('fournisseur_id, fournisseurs!inner(id, nom_commerce, adresse, latitude, longitude)')
    .eq('network_id', network_id)
    .eq('status', 'active')
    .range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<{
    fournisseur_id: string
    fournisseurs:
      | { id: string; nom_commerce: string; adresse: string; latitude: number | string | null; longitude: number | string | null }
      | Array<{ id: string; nom_commerce: string; adresse: string; latitude: number | string | null; longitude: number | string | null }>
      | null
  }>

  const providerIds = rows.map((row) => row.fournisseur_id)

  const clientCountByProvider = new Map<string, number>()

  if (providerIds.length > 0) {
    const { data: clients } = await supabase.from('client_points').select('fournisseur_id').in('fournisseur_id', providerIds)

    for (const row of clients ?? []) {
      const providerId = String(row.fournisseur_id)
      clientCountByProvider.set(providerId, (clientCountByProvider.get(providerId) ?? 0) + 1)
    }
  }

  return rows.map((row) => {
    const provider = Array.isArray(row.fournisseurs) ? row.fournisseurs[0] : row.fournisseurs
    return {
      fournisseur_id: row.fournisseur_id,
      provider_name: provider?.nom_commerce ?? 'Commerce',
      provider_logo_url: null,
      category: null,
      city: provider?.adresse?.split(',')[0]?.trim() ?? null,
      latitude:
        provider?.latitude === null || provider?.latitude === undefined
          ? null
          : Number(provider.latitude),
      longitude:
        provider?.longitude === null || provider?.longitude === undefined
          ? null
          : Number(provider.longitude),
      client_count: clientCountByProvider.get(row.fournisseur_id) ?? 0,
    }
  })
}

export async function requestJoinNetwork(network_id: string, message?: string): Promise<{ status: string; message: string }> {
  const { data, error } = await supabase.functions.invoke('manage-network-membership', {
    body: {
      action: 'REQUEST_JOIN',
      network_id,
      request_message: message,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as { status: string; message: string }
}

export async function leaveNetwork(network_id: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('manage-network-membership', {
    body: {
      action: 'LEAVE_NETWORK',
      network_id,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as { success: boolean }
}

export async function getProviderNetworks(fournisseur_id?: string): Promise<Array<{ network: Network; status: string }>> {
  let providerId: string | null = fournisseur_id ?? null
  if (!providerId) {
    providerId = await getCurrentProviderId()
  }

  if (!providerId) {
    return []
  }

  const { data, error } = await supabase
    .from('network_members')
    .select('network_id, status, networks(*)')
    .eq('fournisseur_id', providerId)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as ProviderMembershipRow[]

  return rows
    .map((row) => {
      const network = Array.isArray(row.networks) ? row.networks[0] : row.networks
      if (!network) {
        return null
      }

      return {
        network: normalizeNetwork(network),
        status: row.status,
      }
    })
    .filter((entry): entry is { network: Network; status: string } => Boolean(entry))
}

export async function enrollInNetwork(network_id: string, invite_code?: string): Promise<{ success: boolean; welcome_bonus_awarded: number }> {
  const { data, error } = await supabase.functions.invoke('manage-client-enrollment', {
    body: {
      action: 'ENROLL_CLIENT',
      network_id,
      client_invite_code: invite_code,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as { success: boolean; welcome_bonus_awarded: number }
}

export async function unenrollFromNetwork(network_id: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('manage-client-enrollment', {
    body: {
      action: 'UNENROLL_CLIENT',
      network_id,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as { success: boolean }
}

export async function getClientNetworks(client_id?: string): Promise<Array<{ network: Network; total_network_points: number; last_activity_at: string | null }>> {
  let clientId: string | null = client_id ?? null

  if (!clientId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    clientId = user?.id ?? null
  }

  if (!clientId) {
    return []
  }

  const { data, error } = await supabase
    .from('network_clients')
    .select('network_id, total_network_points, last_activity_at, networks(*)')
    .eq('client_id', clientId)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as ClientEnrollmentRow[]

  return rows
    .map((row) => {
      const network = Array.isArray(row.networks) ? row.networks[0] : row.networks
      if (!network) {
        return null
      }

      return {
        network: normalizeNetwork(network),
        total_network_points: Number(row.total_network_points ?? 0),
        last_activity_at: row.last_activity_at ?? null,
      }
    })
    .filter((entry): entry is { network: Network; total_network_points: number; last_activity_at: string | null } => Boolean(entry))
}

export async function getEligibleNetworks(): Promise<NetworkWithEligibility[]> {
  const { data, error } = await supabase.functions.invoke('manage-client-enrollment', {
    body: {
      action: 'GET_ELIGIBLE_NETWORKS',
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data?.networks ?? []) as Array<NetworkRow & { is_member?: boolean; eligibility?: NetworkWithEligibility['eligibility'] }>

  return rows.map((row) => ({
    ...normalizeNetwork(row),
    is_member: Boolean(row.is_member),
    eligibility: row.eligibility,
  }))
}

function isAuthFunctionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const context = (error as { context?: { status?: number } }).context
  const status = context?.status

  return status === 401 || status === 403
}

async function getNetworkStatsFallback(network_id: string): Promise<NetworkStats> {
  const [
    memberCount,
    clientCount,
    bonusAggregate,
    txWithBonus,
    topProviders,
    clientGrowth,
    countryRows,
  ] = await Promise.all([
    supabase.from('network_members').select('id', { head: true, count: 'exact' }).eq('network_id', network_id).eq('status', 'active'),
    supabase.from('network_clients').select('id', { head: true, count: 'exact' }).eq('network_id', network_id),
    supabase.from('network_point_events').select('bonus_points').eq('network_id', network_id),
    supabase.from('network_point_events').select('id', { head: true, count: 'exact' }).eq('network_id', network_id),
    supabase
      .from('network_members')
      .select('fournisseur_id, fournisseurs!inner(nom_commerce, adresse)')
      .eq('network_id', network_id)
      .eq('status', 'active')
      .limit(10),
    supabase
      .from('network_clients')
      .select('id', { head: true, count: 'exact' })
      .eq('network_id', network_id)
      .gte('joined_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('network_members')
      .select('fournisseurs!inner(adresse)')
      .eq('network_id', network_id)
      .eq('status', 'active'),
  ])

  const fallbackError =
    memberCount.error ??
    clientCount.error ??
    bonusAggregate.error ??
    txWithBonus.error ??
    topProviders.error ??
    clientGrowth.error ??
    countryRows.error

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  const totalBonusPoints = ((bonusAggregate.data ?? []) as Array<{ bonus_points: number }>).reduce(
    (sum, row) => sum + Number(row.bonus_points ?? 0),
    0,
  )

  const providerRows = (topProviders.data ?? []) as Array<{
    fournisseur_id: string
    fournisseurs: { nom_commerce?: string; adresse?: string }[] | { nom_commerce?: string; adresse?: string } | null
  }>

  const topProvidersByClients = providerRows.map((row) => {
    const provider = Array.isArray(row.fournisseurs) ? row.fournisseurs[0] : row.fournisseurs
    return {
      fournisseur_id: row.fournisseur_id,
      provider_name: provider?.nom_commerce ?? 'Commerce',
      address: provider?.adresse ?? null,
    }
  })

  const countriesRaw = (countryRows.data ?? []) as Array<{
    fournisseurs: { adresse?: string }[] | { adresse?: string } | null
  }>

  const countryCount = new Map<string, number>()

  for (const row of countriesRaw) {
    const provider = Array.isArray(row.fournisseurs) ? row.fournisseurs[0] : row.fournisseurs
    const address = provider?.adresse ?? ''
    const parts = address.split(',').map((value) => value.trim()).filter(Boolean)
    const country = parts.length > 0 ? parts[parts.length - 1] : 'Unknown'
    countryCount.set(country, (countryCount.get(country) ?? 0) + 1)
  }

  const mostActiveCountries = Array.from(countryCount.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)

  const txCount = txWithBonus.count ?? 0

  return {
    member_count: memberCount.count ?? 0,
    client_count: clientCount.count ?? 0,
    total_bonus_points_distributed: totalBonusPoints,
    total_transactions_with_bonus: txCount,
    avg_bonus_per_transaction: txCount > 0 ? totalBonusPoints / txCount : 0,
    top_providers_by_clients: topProvidersByClients,
    client_growth_last_30d: clientGrowth.count ?? 0,
    most_active_countries: mostActiveCountries,
  }
}

export async function getNetworkStats(network_id: string): Promise<NetworkStats> {
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    return getNetworkStatsFallback(network_id)
  }

  const { data, error } = await supabase.functions.invoke('manage-network', {
    body: {
      action: 'GET_STATS',
      network_id,
    },
  })

  if (error) {
    if (isAuthFunctionError(error)) {
      return getNetworkStatsFallback(network_id)
    }

    throw new Error(error.message)
  }

  return data as NetworkStats
}

export async function getNetworkGrowthTimeline(network_id: string, period: '30d' | '90d' | '365d') {
  const { data: clients, error: clientsError } = await supabase
    .from('network_clients')
    .select('joined_at')
    .eq('network_id', network_id)

  const { data: members, error: membersError } = await supabase
    .from('network_members')
    .select('joined_at')
    .eq('network_id', network_id)
    .eq('status', 'active')

  if (clientsError || membersError) {
    throw new Error(clientsError?.message ?? membersError?.message ?? 'Failed to load growth timeline')
  }

  const maxDays = period === '30d' ? 30 : period === '90d' ? 90 : 365
  const since = Date.now() - maxDays * 24 * 60 * 60 * 1000

  const bucket = (rows: Array<{ joined_at: string | null }>) => {
    const map = new Map<string, number>()
    for (const row of rows) {
      const joinedAt = row.joined_at ? new Date(row.joined_at).getTime() : 0
      if (!joinedAt || joinedAt < since) {
        continue
      }
      const key = new Date(joinedAt).toISOString().slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + 1)
    }

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  return {
    clients: bucket((clients ?? []) as Array<{ joined_at: string | null }>),
    members: bucket((members ?? []) as Array<{ joined_at: string | null }>),
  }
}

export async function getNetworkLeaderboard(
  network_id: string,
  limit = 50,
): Promise<{ entries: NetworkLeaderboardEntry[]; myRank: number | null; myScore: number | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('network_clients')
    .select('client_id, total_network_points, profiles!inner(nom, prenom)')
    .eq('network_id', network_id)
    .order('total_network_points', { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)))

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<{
    client_id: string
    total_network_points: number
    profiles: { nom: string | null; prenom: string | null } | Array<{ nom: string | null; prenom: string | null }> | null
  }>

  const entries: NetworkLeaderboardEntry[] = rows.map((row, index) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const prenom = profile?.prenom?.trim() ?? 'Client'
    const nomInitial = profile?.nom?.trim() ? `${profile.nom.trim().charAt(0)}.` : ''

    return {
      rank: index + 1,
      client_id: row.client_id,
      client_name: `${prenom} ${nomInitial}`.trim(),
      score: Number(row.total_network_points ?? 0),
      is_current_user: row.client_id === user?.id,
    }
  })

  const myEntry = entries.find((entry) => entry.is_current_user) ?? null

  let myRank: number | null = myEntry?.rank ?? null
  let myScore: number | null = myEntry?.score ?? null

  if (!myEntry && user?.id) {
    const { data: mine, error: myError } = await supabase
      .from('network_clients')
      .select('total_network_points')
      .eq('network_id', network_id)
      .eq('client_id', user.id)
      .maybeSingle<{ total_network_points: number }>()

    if (!myError && mine) {
      myScore = Number(mine.total_network_points ?? 0)

      const { count } = await supabase
        .from('network_clients')
        .select('id', { count: 'exact', head: true })
        .eq('network_id', network_id)
        .gt('total_network_points', myScore)

      myRank = (count ?? 0) + 1
    }
  }

  return {
    entries,
    myRank,
    myScore,
  }
}

export async function getPlatformNetworkOverview(): Promise<Network[]> {
  const { data, error } = await supabase
    .from('networks')
    .select('*')
    .eq('is_active', true)
    .order('client_count', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as NetworkRow[]).map((row) => normalizeNetwork(row))
}

export async function getAnnouncementsForNetwork(networkId?: string): Promise<NetworkAnnouncement[]> {
  const { data, error } = await supabase.functions.invoke('manage-announcements', {
    body: {
      action: 'GET_ANNOUNCEMENTS',
      network_id: networkId,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data?.announcements ?? []) as NetworkAnnouncement[]
}

export async function createNetwork(payload: Record<string, unknown>): Promise<Network> {
  const { data, error } = await supabase.functions.invoke('manage-network', {
    body: {
      action: 'CREATE_NETWORK',
      payload,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return normalizeNetwork(data.network as NetworkRow)
}

export async function updateNetwork(network_id: string, payload: Record<string, unknown>): Promise<Network> {
  const { data, error } = await supabase.functions.invoke('manage-network', {
    body: {
      action: 'UPDATE_NETWORK',
      network_id,
      payload,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return normalizeNetwork(data.network as NetworkRow)
}

export async function deleteNetwork(network_id: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('manage-network', {
    body: {
      action: 'DELETE_NETWORK',
      network_id,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as { success: boolean }
}

export async function uploadNetworkAsset(params: {
  network_id: string
  type: 'logo' | 'banner'
  file_base64: string
  file_mime_type?: string
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke('manage-network', {
    body: {
      action: params.type === 'logo' ? 'UPLOAD_LOGO' : 'UPLOAD_BANNER',
      network_id: params.network_id,
      file_base64: params.file_base64,
      file_mime_type: params.file_mime_type ?? 'image/webp',
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return params.type === 'logo' ? String(data.logo_url ?? '') : String(data.banner_url ?? '')
}

export async function createAnnouncement(payload: Record<string, unknown>): Promise<NetworkAnnouncement> {
  const { data, error } = await supabase.functions.invoke('manage-announcements', {
    body: {
      action: 'CREATE_ANNOUNCEMENT',
      payload,
      network_id: payload.network_id,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data.announcement as NetworkAnnouncement
}

export async function updateAnnouncement(
  announcement_id: string,
  payload: Record<string, unknown>,
): Promise<NetworkAnnouncement> {
  const { data, error } = await supabase.functions.invoke('manage-announcements', {
    body: {
      action: 'UPDATE_ANNOUNCEMENT',
      announcement_id,
      payload,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data.announcement as NetworkAnnouncement
}

export async function deleteAnnouncement(announcement_id: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('manage-announcements', {
    body: {
      action: 'DELETE_ANNOUNCEMENT',
      announcement_id,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as { success: boolean }
}

export async function getPendingMembershipRequests(): Promise<
  Array<{
    id: string
    network_id: string
    fournisseur_id: string
    request_message: string | null
    created_at: string
    status: string
    networks: { slug: string; name: Record<string, string> | null } | null
    fournisseurs: { nom_commerce: string } | null
  }>
> {
  const { data, error } = await supabase
    .from('network_members')
    .select('id, network_id, fournisseur_id, request_message, created_at, status, networks(slug, name), fournisseurs(nom_commerce)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<{
    id: string
    network_id: string
    fournisseur_id: string
    request_message: string | null
    created_at: string
    status: string
    networks:
      | { slug: string; name: Record<string, string> | null }
      | Array<{ slug: string; name: Record<string, string> | null }>
      | null
    fournisseurs:
      | { nom_commerce: string }
      | Array<{ nom_commerce: string }>
      | null
  }>

  return rows.map((row) => {
    const network = Array.isArray(row.networks) ? row.networks[0] ?? null : row.networks
    const provider = Array.isArray(row.fournisseurs) ? row.fournisseurs[0] ?? null : row.fournisseurs

    return {
      id: row.id,
      network_id: row.network_id,
      fournisseur_id: row.fournisseur_id,
      request_message: row.request_message,
      created_at: row.created_at,
      status: row.status,
      networks: network,
      fournisseurs: provider,
    }
  })
}

export async function validateMembership(membership_id: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('manage-network-membership', {
    body: {
      action: 'VALIDATE_MEMBER',
      membership_id,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as { success: boolean }
}

export async function rejectMembership(
  membership_id: string,
  rejection_reason?: string,
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('manage-network-membership', {
    body: {
      action: 'REJECT_MEMBER',
      membership_id,
      rejection_reason,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as { success: boolean }
}

export async function suspendMembership(
  membership_id: string,
  suspension_reason?: string,
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('manage-network-membership', {
    body: {
      action: 'SUSPEND_MEMBER',
      membership_id,
      suspension_reason,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as { success: boolean }
}

export function subscribeToNetworkUpdates(
  network_id: string,
  callback: (event: { type: 'member_joined' | 'announcement_created'; payload: unknown }) => void,
) {
  const membersChannel = supabase
    .channel(`network-members-${network_id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'network_members',
        filter: `network_id=eq.${network_id}`,
      },
      (payload) => callback({ type: 'member_joined', payload }),
    )
    .subscribe()

  const announcementsChannel = supabase
    .channel(`network-announcements-${network_id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'network_announcements',
        filter: `network_id=eq.${network_id}`,
      },
      (payload) => callback({ type: 'announcement_created', payload }),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(membersChannel)
    void supabase.removeChannel(announcementsChannel)
  }
}
