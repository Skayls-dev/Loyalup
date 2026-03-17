import { createClient } from 'npm:@supabase/supabase-js@2'
import * as jose from 'npm:jose@4.14.6'

type Action = 'getOverview' | 'getClientGrowthTimeline' | 'getMerchantLeaderboard' | 'getGeographicBreakdown'

type Period = '7d' | '30d' | '90d' | '365d'

interface Body {
  action?: Action
  period?: Period
}

interface InstitutionOverview {
  network: {
    id: string
    slug: string
    name: Record<string, string> | null
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

interface GrowthPoint {
  date: string
  new_clients: number
  cumulative: number
}

interface MerchantLeaderboardEntry {
  nom_commerce: string
  city: string | null
  country: string | null
  unique_clients: number
  total_bonus_points: number
  transaction_count: number
}

interface GeographicEntry {
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

function periodToDays(period?: Period): number {
  if (period === '7d') return 7
  if (period === '30d') return 30
  if (period === '90d') return 90
  return 365
}

function toDateBucket(value: string): string {
  return new Date(value).toISOString().slice(0, 10)
}

function decodeJwt(token: string): { sub?: string; [key: string]: unknown } {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('Invalid token format')
    const payload = parts[1]
    const decoded = JSON.parse(new TextDecoder().decode(jose.base64url.decode(payload)))
    return decoded
  } catch {
    throw new Error('Failed to decode JWT')
  }
}

async function getInstitutionContext(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: json({ error: 'Missing env vars' }, 500), admin: null, userId: null, networkId: null }
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null, userId: null, networkId: null }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const admin = createClient(supabaseUrl, serviceRoleKey)

  let userId: string
  try {
    const payload = decodeJwt(token)
    userId = payload.sub as string
    if (!userId) throw new Error('No sub claim in JWT')
  } catch {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null, userId: null, networkId: null }
  }

  // Check if user is institution or admin
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<{ role: string }>()

  if (profileError || !profile || (profile.role !== 'institution' && profile.role !== 'admin')) {
    return { error: json({ error: 'Forbidden: only institutions can access' }, 403), admin: null, userId: null, networkId: null }
  }

  // Get network_id from institution_network_access
  const { data: access, error: accessError } = await admin
    .from('institution_network_access')
    .select('network_id')
    .eq('profile_id', userId)
    .maybeSingle<{ network_id: string }>()

  if (accessError || !access?.network_id) {
    return { error: json({ error: 'No network access found' }, 403), admin: null, userId: null, networkId: null }
  }

  return { error: null, admin, userId, networkId: access.network_id }
}

async function getOverview(admin: ReturnType<typeof createClient>, networkId: string, period?: Period): Promise<InstitutionOverview> {
  const periodDays = periodToDays(period)
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
  const prevStart = new Date(Date.now() - periodDays * 2 * 24 * 60 * 60 * 1000).toISOString()
  const prevEnd = periodStart

  // Get network info
  const { data: network } = await admin
    .from('networks')
    .select('id, slug, name, member_count, client_count')
    .eq('id', networkId)
    .maybeSingle<{ id: string; slug: string; name: Record<string, string> | null; member_count: number; client_count: number }>()

  // Get new clients in current period
  const { data: currentClients } = await admin
    .from('network_clients')
    .select('joined_at', { head: true, count: 'exact' })
    .eq('network_id', networkId)
    .gte('joined_at', periodStart)

  // Get new clients in previous period
  const { data: prevClients } = await admin
    .from('network_clients')
    .select('joined_at', { head: true, count: 'exact' })
    .eq('network_id', networkId)
    .gte('joined_at', prevStart)
    .lt('joined_at', prevEnd)

  // Get active merchants with events in current period
  const { data: eventsData } = await admin
    .from('network_point_events')
    .select('fournisseur_id, bonus_points')
    .eq('network_id', networkId)
    .gte('created_at', periodStart)

  const activeMerchantsSet = new Set<string>()
  let totalBonusDistributed = 0
  for (const event of eventsData ?? []) {
    if (event.fournisseur_id) {
      activeMerchantsSet.add(event.fournisseur_id as string)
    }
    totalBonusDistributed += Number(event.bonus_points ?? 0)
  }

  // Get active merchants in previous period for comparison
  const { data: prevEventsData } = await admin
    .from('network_point_events')
    .select('fournisseur_id')
    .eq('network_id', networkId)
    .gte('created_at', prevStart)
    .lt('created_at', prevEnd)

  const prevActiveMerchantsSet = new Set<string>()
  for (const event of prevEventsData ?? []) {
    if (event.fournisseur_id) {
      prevActiveMerchantsSet.add(event.fournisseur_id as string)
    }
  }

  const currentPeriodClients = Number(currentClients?.count ?? 0)
  const prevPeriodClients = Number(prevClients?.count ?? 0)
  const currentActiveMerchants = activeMerchantsSet.size
  const prevActiveMerchants = prevActiveMerchantsSet.size
  const transactionCount = eventsData?.length ?? 0

  const clientGrowthPct =
    prevPeriodClients > 0 ? ((currentPeriodClients - prevPeriodClients) / prevPeriodClients) * 100 : currentPeriodClients > 0 ? 100 : 0

  const merchantGrowthPct =
    prevActiveMerchants > 0
      ? ((currentActiveMerchants - prevActiveMerchants) / prevActiveMerchants) * 100
      : currentActiveMerchants > 0
        ? 100
        : 0

  return {
    network: {
      id: network?.id ?? networkId,
      slug: network?.slug ?? '',
      name: network?.name ?? null,
      member_count: network?.member_count ?? 0,
      client_count: network?.client_count ?? 0,
    },
    period_stats: {
      new_clients: currentPeriodClients,
      active_merchants: currentActiveMerchants,
      total_bonus_distributed: totalBonusDistributed,
      transaction_count: transactionCount,
    },
    growth: {
      clients_pct: clientGrowthPct,
      merchants_pct: merchantGrowthPct,
    },
  }
}

async function getClientGrowthTimeline(admin: ReturnType<typeof createClient>, networkId: string, period?: Period): Promise<GrowthPoint[]> {
  const periodDays = periodToDays(period)
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: clients } = await admin
    .from('network_clients')
    .select('joined_at')
    .eq('network_id', networkId)
    .gte('joined_at', periodStart)
    .order('joined_at', { ascending: true })

  const dailyNewClients = new Map<string, number>()
  for (const client of clients ?? []) {
    if (!client.joined_at) continue
    const key = toDateBucket(String(client.joined_at))
    dailyNewClients.set(key, (dailyNewClients.get(key) ?? 0) + 1)
  }

  // Build cumulative timeline
  const sortedDates = Array.from(dailyNewClients.keys()).sort()
  const timeline: GrowthPoint[] = []
  let cumulative = 0

  for (const date of sortedDates) {
    cumulative += dailyNewClients.get(date) ?? 0
    timeline.push({
      date,
      new_clients: dailyNewClients.get(date) ?? 0,
      cumulative,
    })
  }

  return timeline
}

async function getMerchantLeaderboard(admin: ReturnType<typeof createClient>, networkId: string, period?: Period): Promise<MerchantLeaderboardEntry[]> {
  const periodDays = periodToDays(period)
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  // Get events in current period
  const { data: eventsInPeriod } = await admin
    .from('network_point_events')
    .select('fournisseur_id, bonus_points, client_id')
    .eq('network_id', networkId)
    .gte('created_at', periodStart)

  const merchantEventMap = new Map<string, { unique_clients: Set<string>; bonus: number; count: number }>()

  if (eventsInPeriod) {
    for (const event of eventsInPeriod) {
      const merchantId = event.fournisseur_id as string | null
      if (!merchantId) continue

      if (!merchantEventMap.has(merchantId)) {
        merchantEventMap.set(merchantId, {
          unique_clients: new Set<string>(),
          bonus: 0,
          count: 0,
        })
      }

      const stats = merchantEventMap.get(merchantId)!
      stats.unique_clients.add(event.client_id as string)
      stats.bonus += Number(event.bonus_points ?? 0)
      stats.count += 1
    }
  }

  // Get merchant details from summary
  const { data: merchantsData } = await admin
    .from('institution_merchant_summary')
    .select('nom_commerce, city, country')
    .eq('network_id', networkId)

  const leaderboard: MerchantLeaderboardEntry[] = (merchantsData ?? [])
    .filter((m) => merchantEventMap.has((m.nom_commerce as string) ?? ''))
    .map((m) => {
      const merchantName = m.nom_commerce as string
      const stats = merchantEventMap.get(merchantName) || { unique_clients: new Set(), bonus: 0, count: 0 }
      return {
        nom_commerce: merchantName,
        city: (m.city as string | null) ?? null,
        country: (m.country as string | null) ?? null,
        unique_clients: stats.unique_clients.size,
        total_bonus_points: stats.bonus,
        transaction_count: stats.count,
      }
    })
    .sort((a, b) => b.unique_clients - a.unique_clients)
    .slice(0, 20)

  return leaderboard
}

async function getGeographicBreakdown(admin: ReturnType<typeof createClient>, networkId: string): Promise<GeographicEntry[]> {
  const { data: merchantsByGeo } = await admin
    .from('institution_merchant_summary')
    .select('country, city, unique_clients')
    .eq('network_id', networkId)

  if (!merchantsByGeo) return []

  const geoMap = new Map<string, { merchant_count: number; client_count: number }>()

  for (const merchant of merchantsByGeo) {
    const key = `${merchant.country ?? 'Unknown'}|${merchant.city ?? 'Unknown'}`

    if (!geoMap.has(key)) {
      geoMap.set(key, { merchant_count: 0, client_count: 0 })
    }

    const stats = geoMap.get(key)!
    stats.merchant_count += 1
    stats.client_count += Number(merchant.unique_clients ?? 0)
  }

  const breakdown: GeographicEntry[] = Array.from(geoMap.entries()).map(([key, stats]) => {
    const [country, city] = key.split('|')
    return {
      country,
      city: city === 'Unknown' ? null : city,
      merchant_count: stats.merchant_count,
      client_count: stats.client_count,
    }
  })

  return breakdown.sort((a, b) => b.client_count - a.client_count)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const context = await getInstitutionContext(req)
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

  try {
    if (action === 'getOverview') {
      const overview = await getOverview(admin, networkId, body.period)
      return json({ overview })
    }

    if (action === 'getClientGrowthTimeline') {
      const timeline = await getClientGrowthTimeline(admin, networkId, body.period)
      return json({ timeline })
    }

    if (action === 'getMerchantLeaderboard') {
      const leaderboard = await getMerchantLeaderboard(admin, networkId, body.period)
      return json({ leaderboard })
    }

    if (action === 'getGeographicBreakdown') {
      const breakdown = await getGeographicBreakdown(admin, networkId)
      return json({ breakdown })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    console.error('Error processing request:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
