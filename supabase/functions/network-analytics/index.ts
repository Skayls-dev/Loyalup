import { createClient } from 'npm:@supabase/supabase-js@2'

type Action = 'getNetworkStats' | 'getPlatformNetworkOverview'

type Body = {
  action?: Action
  network_id?: string
  period?: '7d' | '30d' | '90d' | '365d'
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

function toDateBucket(value: string): string {
  return new Date(value).toISOString().slice(0, 10)
}

function periodToDays(period: Body['period']): number {
  if (period === '7d') return 7
  if (period === '30d') return 30
  if (period === '90d') return 90
  return 365
}

async function getAdminContext(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: json({ error: 'Missing env vars' }, 500), admin: null }
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user?.id) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null }
  }

  const { data: profile, error: roleError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle<{ role: string }>()

  if (roleError || profile?.role !== 'admin') {
    return { error: json({ error: 'Forbidden' }, 403), admin: null }
  }

  return { error: null, admin }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const context = await getAdminContext(req)
  if (context.error || !context.admin) {
    return context.error ?? json({ error: 'Unauthorized' }, 401)
  }

  const { admin } = context

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

  if (action === 'getPlatformNetworkOverview') {
    const { data, error } = await admin
      .from('networks')
      .select('id, slug, name, category, points_multiplier, member_count, client_count, is_active, is_draft, is_featured, created_at, updated_at')
      .order('client_count', { ascending: false })

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ networks: data ?? [] })
  }

  if (action === 'getNetworkStats') {
    const networkId = String(body.network_id ?? '')
    if (!networkId) {
      return json({ error: 'network_id is required' }, 400)
    }

    const periodDays = periodToDays(body.period)
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

    const [
      members,
      clients,
      events,
      transfers,
      announcements,
      providerMembers,
      providers,
      clientProfiles,
      network,
    ] = await Promise.all([
      admin.from('network_members').select('id, joined_at, fournisseur_id').eq('network_id', networkId).eq('status', 'active'),
      admin.from('network_clients').select('id, joined_at, client_id').eq('network_id', networkId),
      admin
        .from('network_point_events')
        .select('bonus_points, created_at, fournisseur_id, client_id')
        .eq('network_id', networkId),
      admin
        .from('point_transfers')
        .select('points_credited, created_at')
        .gte('created_at', periodStart),
      admin
        .from('network_announcements')
        .select('id, title, created_at')
        .eq('network_id', networkId),
      admin
        .from('network_members')
        .select('fournisseur_id')
        .eq('network_id', networkId)
        .eq('status', 'active'),
      admin
        .from('fournisseurs')
        .select('id, nom_commerce, adresse')
        .in('id', []),
      admin.from('profiles').select('id, nom, email').in('id', []),
      admin.from('networks').select('id, slug, name').eq('id', networkId).maybeSingle<{ id: string; slug: string; name: Record<string, string> | null }>(),
    ])

    const providerIds = (providerMembers.data ?? []).map((row) => row.fournisseur_id as string)
    const clientIds = (clients.data ?? []).map((row) => row.client_id as string)

    const [providersResolved, clientsResolved] = await Promise.all([
      providerIds.length
        ? admin.from('fournisseurs').select('id, nom_commerce, adresse').in('id', providerIds)
        : Promise.resolve({ data: [] as Array<{ id: string; nom_commerce: string; adresse: string | null }>, error: null }),
      clientIds.length
        ? admin.from('profiles').select('id, nom, email').in('id', clientIds)
        : Promise.resolve({ data: [] as Array<{ id: string; nom: string; email: string }>, error: null }),
    ])

    const memberCount = Number(members.data?.length ?? 0)
    const clientCount = Number(clients.data?.length ?? 0)
    const eventRows = (events.data ?? []) as Array<{
      bonus_points: number
      created_at: string
      fournisseur_id: string | null
      client_id: string
    }>

    const totalBonusDistributed = eventRows.reduce((sum, row) => sum + Number(row.bonus_points ?? 0), 0)
    const totalTransactions = eventRows.length

    const providerClientCounts = new Map<string, number>()
    const providerTxCounts = new Map<string, number>()
    const clientPoints = new Map<string, number>()

    for (const row of eventRows) {
      if (row.fournisseur_id) {
        providerTxCounts.set(row.fournisseur_id, (providerTxCounts.get(row.fournisseur_id) ?? 0) + 1)
      }
      clientPoints.set(row.client_id, (clientPoints.get(row.client_id) ?? 0) + Number(row.bonus_points ?? 0))
    }

    for (const client of clients.data ?? []) {
      const clientId = String(client.client_id)
      const relatedProviders = new Set(
        eventRows
          .filter((event) => event.client_id === clientId && event.fournisseur_id)
          .map((event) => String(event.fournisseur_id)),
      )

      for (const providerId of relatedProviders) {
        providerClientCounts.set(providerId, (providerClientCounts.get(providerId) ?? 0) + 1)
      }
    }

    const membersByCountry = new Map<string, number>()
    for (const provider of providersResolved.data ?? []) {
      const parts = String(provider.adresse ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      const country = parts.length > 0 ? parts[parts.length - 1] : 'Unknown'
      membersByCountry.set(country, (membersByCountry.get(country) ?? 0) + 1)
    }

    const clientsByCity = new Map<string, number>()
    for (const provider of providersResolved.data ?? []) {
      const parts = String(provider.adresse ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      const city = parts.length > 0 ? parts[0] : 'Unknown'
      clientsByCity.set(city, (clientsByCity.get(city) ?? 0) + 1)
    }

    const dailyNewMembers = new Map<string, number>()
    for (const member of members.data ?? []) {
      if (!member.joined_at) continue
      const key = toDateBucket(String(member.joined_at))
      dailyNewMembers.set(key, (dailyNewMembers.get(key) ?? 0) + 1)
    }

    const dailyNewClients = new Map<string, number>()
    for (const client of clients.data ?? []) {
      if (!client.joined_at) continue
      const key = toDateBucket(String(client.joined_at))
      dailyNewClients.set(key, (dailyNewClients.get(key) ?? 0) + 1)
    }

    const dailyBonusPoints = new Map<string, number>()
    for (const event of eventRows) {
      const key = toDateBucket(String(event.created_at))
      dailyBonusPoints.set(key, (dailyBonusPoints.get(key) ?? 0) + Number(event.bonus_points ?? 0))
    }

    const now = Date.now()
    const currentPeriodMembers = (members.data ?? []).filter((row) => row.joined_at && new Date(String(row.joined_at)).getTime() >= new Date(periodStart).getTime()).length
    const currentPeriodClients = (clients.data ?? []).filter((row) => row.joined_at && new Date(String(row.joined_at)).getTime() >= new Date(periodStart).getTime()).length

    const prevStart = new Date(now - periodDays * 2 * 24 * 60 * 60 * 1000).toISOString()
    const prevEnd = periodStart

    const prevPeriodMembers = (members.data ?? []).filter((row) => {
      if (!row.joined_at) return false
      const t = new Date(String(row.joined_at)).toISOString()
      return t >= prevStart && t < prevEnd
    }).length

    const prevPeriodClients = (clients.data ?? []).filter((row) => {
      if (!row.joined_at) return false
      const t = new Date(String(row.joined_at)).toISOString()
      return t >= prevStart && t < prevEnd
    }).length

    const memberGrowthPct = prevPeriodMembers > 0 ? ((currentPeriodMembers - prevPeriodMembers) / prevPeriodMembers) * 100 : currentPeriodMembers > 0 ? 100 : 0
    const clientGrowthPct = prevPeriodClients > 0 ? ((currentPeriodClients - prevPeriodClients) / prevPeriodClients) * 100 : currentPeriodClients > 0 ? 100 : 0

    const providersByClients = (providersResolved.data ?? [])
      .map((provider) => ({
        id: provider.id,
        nom_commerce: provider.nom_commerce,
        clients: providerClientCounts.get(provider.id) ?? 0,
      }))
      .sort((a, b) => b.clients - a.clients)
      .slice(0, 10)

    const providersByTransactions = (providersResolved.data ?? [])
      .map((provider) => ({
        id: provider.id,
        nom_commerce: provider.nom_commerce,
        transactions: providerTxCounts.get(provider.id) ?? 0,
      }))
      .sort((a, b) => b.transactions - a.transactions)
      .slice(0, 10)

    const clientsByNetworkPoints = (clientsResolved.data ?? [])
      .map((client) => ({
        id: client.id,
        nom: client.nom,
        email: client.email,
        points: clientPoints.get(client.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)

    const coalitionTransfersVolume = ((transfers.data ?? []) as Array<{ points_credited: number }>).reduce(
      (sum, row) => sum + Number(row.points_credited ?? 0),
      0,
    )

    const output = {
      overview: {
        member_count: memberCount,
        client_count: clientCount,
        total_transactions: totalTransactions,
        total_bonus_distributed: totalBonusDistributed,
        avg_bonus_per_transaction: totalTransactions > 0 ? totalBonusDistributed / totalTransactions : 0,
        coalition_transfers_volume: coalitionTransfersVolume,
      },
      growth: {
        members_added_period: currentPeriodMembers,
        clients_added_period: currentPeriodClients,
        member_growth_pct: memberGrowthPct,
        client_growth_pct: clientGrowthPct,
      },
      geographic: {
        members_by_country: Array.from(membersByCountry.entries()).map(([country, count]) => ({ country, count })),
        clients_by_city: Array.from(clientsByCity.entries()).map(([city, count]) => ({ city, count })),
      },
      top_performers: {
        providers_by_clients: providersByClients,
        providers_by_transactions: providersByTransactions,
        clients_by_network_points: clientsByNetworkPoints,
      },
      timeline: {
        daily_new_members: Array.from(dailyNewMembers.entries()).map(([date, count]) => ({ date, count })),
        daily_new_clients: Array.from(dailyNewClients.entries()).map(([date, count]) => ({ date, count })),
        daily_bonus_points: Array.from(dailyBonusPoints.entries()).map(([date, points]) => ({ date, points })),
      },
      announcements: {
        total_sent: Number(announcements.data?.length ?? 0),
        avg_open_rate: 0,
        best_performing: announcements.data?.[0] ?? null,
      },
      network: network.data
        ? {
            id: network.data.id,
            slug: network.data.slug,
            name: network.data.name,
          }
        : null,
    }

    return json(output)
  }

  return json({ error: `Unsupported action: ${action}` }, 400)
})
