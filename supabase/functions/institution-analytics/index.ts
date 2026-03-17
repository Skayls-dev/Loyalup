import { createClient } from 'npm:@supabase/supabase-js@2'

type Action = 'getOverview' | 'getClientGrowthTimeline' | 'getMerchantLeaderboard' | 'getGeographicBreakdown'

type Period = '7d' | '30d' | '90d' | '365d'

type Body = {
  action?: Action
  period?: Period
}

type InstitutionOverview = {
  network: {
    id: string
    slug: string
    name: Record<string, string> | null
    emoji: string
    primary_color: string
    member_count: number
    client_count: number
  }
  period_stats: {
    new_clients: number
    active_merchants: number
    total_bonus_distributed: number
    transaction_count: number
  }
  growth: {
    clients_pct: number
    merchants_pct: number
  }
}

type GrowthPoint = {
  date: string
  new_clients: number
  cumulative: number
}

type MerchantLeaderboardEntry = {
  nom_commerce: string
  city: string | null
  country: string | null
  unique_clients: number
  total_bonus_points: number
  transaction_count: number
}

type GeographicEntry = {
  country: string
  city: string | null
  merchant_count: number
  client_count: number
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

function periodToDays(period: Period): number {
  if (period === '7d') return 7
  if (period === '30d') return 30
  if (period === '90d') return 90
  return 365
}

async function getContext(req: Request) {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Missing Authorization header' }, 401), admin: null, userId: null, networkId: null }
  }

  const token = authHeader.slice(7)
  const { data: userData, error: userError } = await admin.auth.getUser(token)

  if (userError || !userData.user?.id) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null, userId: null, networkId: null }
  }

  const userId = userData.user.id

  // Get user profile and role
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<{ role: string }>()

  if (profileError) {
    return { error: json({ error: profileError.message }, 500), admin: null, userId: null, networkId: null }
  }

  const role = profile?.role

  // Only 'institution' and 'admin' can access (admin for testing/managing)
  if (role !== 'institution' && role !== 'admin') {
    return { error: json({ error: 'Forbidden - invalid role' }, 403), admin: null, userId: null, networkId: null }
  }

  // Get the network_id from institution_network_access
  const { data: access, error: accessError } = await admin
    .from('institution_network_access')
    .select('network_id')
    .eq('profile_id', userId)
    .maybeSingle<{ network_id: string }>()

  if (accessError || !access?.network_id) {
    return { error: json({ error: 'No network access configured' }, 403), admin: null, userId: null, networkId: null }
  }

  return { error: null, admin, userId, networkId: access.network_id }
}

async function getOverview(admin: ReturnType<typeof createClient>, networkId: string, period: Period): Promise<InstitutionOverview> {
  const periodDays = periodToDays(period)
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
  const previousPeriodStart = new Date(Date.now() - periodDays * 2 * 24 * 60 * 60 * 1000)

  // Fetch network details
  const { data: network, error: networkError } = await admin
    .from('networks')
    .select('id, slug, name, emoji, primary_color, member_count, client_count')
    .eq('id', networkId)
    .maybeSingle<{
      id: string
      slug: string
      name: Record<string, string> | null
      emoji: string
      primary_color: string
      member_count: number
      client_count: number
    }>()

  if (networkError || !network) {
    throw new Error('Network not found')
  }

  // Current period stats
  const [newClientsResult, activeMerchantsResult, bonusResult, txCountResult] = await Promise.all([
    admin
      .from('network_clients')
      .select('id', { head: true, count: 'exact' })
      .eq('network_id', networkId)
      .gte('joined_at', periodStart.toISOString()),

    admin.from('network_point_events')
      .select('fournisseur_id')
      .eq('network_id', networkId)
      .gte('created_at', periodStart.toISOString()),

    admin
      .from('network_point_events')
      .select('bonus_points')
      .eq('network_id', networkId)
      .gte('created_at', periodStart.toISOString()),

    admin
      .from('network_point_events')
      .select('id', { head: true, count: 'exact' })
      .eq('network_id', networkId)
      .gte('created_at', periodStart.toISOString()),
  ])

  const newClients = Number(newClientsResult.count ?? 0)
  const activeMerchants = new Set((activeMerchantsResult.data ?? []).map((r) => r.fournisseur_id)).size
  const totalBonusDistributed = ((bonusResult.data ?? []) as Array<{ bonus_points: number }>)
    .reduce((sum, r) => sum + Number(r.bonus_points ?? 0), 0)
  const txCount = Number(txCountResult.count ?? 0)

  // Previous period stats for growth calculation
  const [prevNewClientsResult, prevActiveMerchantsResult] = await Promise.all([
    admin
      .from('network_clients')
      .select('id', { head: true, count: 'exact' })
      .eq('network_id', networkId)
      .gte('joined_at', previousPeriodStart.toISOString())
      .lt('joined_at', periodStart.toISOString()),

    admin.from('network_point_events')
      .select('fournisseur_id')
      .eq('network_id', networkId)
      .gte('created_at', previousPeriodStart.toISOString())
      .lt('created_at', periodStart.toISOString()),
  ])

  const prevNewClients = Number(prevNewClientsResult.count ?? 0)
  const prevActiveMerchants = new Set((prevActiveMerchantsResult.data ?? []).map((r) => r.fournisseur_id)).size

  const clientsPct = prevNewClients > 0 ? ((newClients - prevNewClients) / prevNewClients) * 100 : 0
  const merchantsPct = prevActiveMerchants > 0 ? ((activeMerchants - prevActiveMerchants) / prevActiveMerchants) * 100 : 0

  return {
    network,
    period_stats: {
      new_clients: newClients,
      active_merchants: activeMerchants,
      total_bonus_distributed: totalBonusDistributed,
      transaction_count: txCount,
    },
    growth: {
      clients_pct: clientsPct,
      merchants_pct: merchantsPct,
    },
  }
}

async function getClientGrowthTimeline(admin: ReturnType<typeof createClient>, networkId: string, period: Period): Promise<GrowthPoint[]> {
  const periodDays = periodToDays(period)
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

  const { data: dailyData } = await admin
    .from('institution_network_summary')
    .select('joined_day, new_clients')
    .eq('network_id', networkId)
    .gte('joined_day', periodStart.toISOString())
    .order('joined_day', { ascending: true })

  const dailyRows = (dailyData ?? []) as Array<{ joined_day: string; new_clients: number }>

  const timeline: GrowthPoint[] = []
  let cumulative = 0

  for (const row of dailyRows) {
    cumulative += Number(row.new_clients ?? 0)
    timeline.push({
      date: new Date(row.joined_day).toISOString().slice(0, 10),
      new_clients: Number(row.new_clients ?? 0),
      cumulative,
    })
  }

  return timeline
}

async function getMerchantLeaderboard(
  admin: ReturnType<typeof createClient>,
  networkId: string,
  _period: Period,
): Promise<MerchantLeaderboardEntry[]> {
  const { data: merchants } = await admin
    .from('institution_merchant_summary')
    .select('nom_commerce, city, country, unique_clients, total_bonus_points, transaction_count')
    .eq('network_id', networkId)
    .order('unique_clients', { ascending: false })
    .limit(20)

  return (merchants ?? []) as MerchantLeaderboardEntry[]
}

async function getGeographicBreakdown(admin: ReturnType<typeof createClient>, networkId: string): Promise<GeographicEntry[]> {
  // Get merchant distribution by country/city
  const { data: merchantsByLocation } = await admin
    .from('institution_merchant_summary')
    .select('country, city, unique_clients')
    .eq('network_id', networkId)

  const locationMap = new Map<string, { merchant_count: number; client_count: number }>()

  for (const row of merchantsByLocation ?? []) {
    const key = `${row.country ?? 'Unknown'}|${row.city ?? 'Unknown'}`
    const existing = locationMap.get(key) ?? { merchant_count: 0, client_count: 0 }
    existing.merchant_count += 1
    existing.client_count += Number(row.unique_clients ?? 0)
    locationMap.set(key, existing)
  }

  const geographic: GeographicEntry[] = []
  for (const [key, stats] of locationMap.entries()) {
    const [country, city] = key.split('|')
    geographic.push({
      country: country ?? 'Unknown',
      city: city === 'Unknown' ? null : city,
      merchant_count: stats.merchant_count,
      client_count: stats.client_count,
    })
  }

  return geographic.sort((a, b) => b.client_count - a.client_count)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const context = await getContext(req)
  if (context.error || !context.admin || !context.networkId) {
    return context.error ?? json({ error: 'Unauthorized' }, 401)
  }

  const { admin, networkId } = context

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

  const period = (body.period ?? '30d') as Period

  try {
    if (action === 'getOverview') {
      const data = await getOverview(admin, networkId, period)
      return json(data)
    }

    if (action === 'getClientGrowthTimeline') {
      const data = await getClientGrowthTimeline(admin, networkId, period)
      return json(data)
    }

    if (action === 'getMerchantLeaderboard') {
      const data = await getMerchantLeaderboard(admin, networkId, period)
      return json(data)
    }

    if (action === 'getGeographicBreakdown') {
      const data = await getGeographicBreakdown(admin, networkId)
      return json(data)
    }

    return json({ error: `Unsupported action: ${action}` }, 400)
  } catch (err) {
    console.error(`Error in action ${action}:`, err)
    return json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500)
  }
})
