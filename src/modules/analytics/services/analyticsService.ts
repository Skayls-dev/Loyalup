import { supabase } from '../../../shared/lib/supabaseClient'

type Period = '7d' | '30d' | '90d' | '12m'

type RevenuePoint = {
  label: string
  revenue: number
  transactions: number
  points: number
}

export type ProviderDeepStats = {
  revenue: number
  transactions: number
  avgBasket: number
  retentionRate: number
  churnRate: number
  rewardRedemptionRate: number
  promotionConversionRate: number
  topClients: Array<{ client_id: string; revenue: number }>
  bestHour: number
  bestDay: number
}

export async function getProviderDeepStats(fournisseur_id: string, period: Period): Promise<ProviderDeepStats> {
  const since = getSinceDate(period)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('client_id, montant, points_credited, created_at, status')
    .eq('fournisseur_id', fournisseur_id)
    .eq('status', 'validated')
    .gte('created_at', since.toISOString())

  const rows = transactions ?? []
  const revenue = rows.reduce((sum, row) => sum + Number(row.montant ?? 0), 0)
  const txCount = rows.length
  const avgBasket = txCount > 0 ? revenue / txCount : 0

  const clientCounts = new Map<string, number>()
  const clientRevenue = new Map<string, number>()
  const hourly = new Map<number, number>()
  const weekday = new Map<number, number>()

  for (const row of rows) {
    const clientId = String(row.client_id ?? '')
    if (clientId) {
      clientCounts.set(clientId, (clientCounts.get(clientId) ?? 0) + 1)
      clientRevenue.set(clientId, (clientRevenue.get(clientId) ?? 0) + Number(row.montant ?? 0))
    }

    const date = new Date(String(row.created_at))
    const hour = date.getHours()
    const day = date.getDay()
    hourly.set(hour, (hourly.get(hour) ?? 0) + 1)
    weekday.set(day, (weekday.get(day) ?? 0) + 1)
  }

  const returningClients = Array.from(clientCounts.values()).filter((count) => count >= 2).length
  const totalClients = clientCounts.size
  const retentionRate = totalClients > 0 ? (returningClients / totalClients) * 100 : 0

  const churnRows = await getChurnList(fournisseur_id)
  const churnRate = totalClients > 0 ? (churnRows.length / totalClients) * 100 : 0

  const topClients = Array.from(clientRevenue.entries())
    .map(([client_id, value]) => ({ client_id, revenue: value }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const bestHour = getTopKey(hourly)
  const bestDay = getTopKey(weekday)

  return {
    revenue,
    transactions: txCount,
    avgBasket,
    retentionRate,
    churnRate,
    rewardRedemptionRate: 0,
    promotionConversionRate: 0,
    topClients,
    bestHour,
    bestDay,
  }
}

export async function getClientSegments(fournisseur_id: string) {
  const { data: providerClients } = await supabase
    .from('client_points')
    .select('client_id')
    .eq('fournisseur_id', fournisseur_id)

  const clientIds = (providerClients ?? []).map((item) => String(item.client_id))

  if (clientIds.length === 0) {
    return {
      distribution: [] as Array<{ segment_type: string; total: number }>,
      champions: [] as string[],
      atRisk: [] as string[],
    }
  }

  const { data: segments } = await supabase
    .from('user_segments')
    .select('client_id, segment_type')
    .in('client_id', clientIds)

  const distributionMap = new Map<string, number>()
  const champions: string[] = []
  const atRisk: string[] = []

  for (const row of segments ?? []) {
    const type = String(row.segment_type)
    distributionMap.set(type, (distributionMap.get(type) ?? 0) + 1)

    if (type === 'champion') {
      champions.push(String(row.client_id))
    }

    if (type === 'at_risk') {
      atRisk.push(String(row.client_id))
    }
  }

  return {
    distribution: Array.from(distributionMap.entries()).map(([segment_type, total]) => ({ segment_type, total })),
    champions,
    atRisk,
  }
}

export async function getBenchmarks(fournisseur_id: string) {
  const { data, error } = await supabase
    .from('provider_benchmarks')
    .select('metric_key, metric_value, industry_avg, industry_p25, industry_p75, period')
    .eq('fournisseur_id', fournisseur_id)
    .order('computed_at', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getRevenueTimeline(
  fournisseur_id: string,
  period: Period,
  granularity: 'daily' | 'weekly' | 'monthly',
): Promise<RevenuePoint[]> {
  const since = getSinceDate(period)

  const { data } = await supabase
    .from('transactions')
    .select('montant, points_credited, created_at')
    .eq('fournisseur_id', fournisseur_id)
    .eq('status', 'validated')
    .gte('created_at', since.toISOString())

  const map = new Map<string, RevenuePoint>()

  for (const row of data ?? []) {
    const date = new Date(String(row.created_at))
    const label = formatBucket(date, granularity)

    const existing = map.get(label) ?? { label, revenue: 0, transactions: 0, points: 0 }
    existing.revenue += Number(row.montant ?? 0)
    existing.transactions += 1
    existing.points += Number(row.points_credited ?? 0)
    map.set(label, existing)
  }

  return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label))
}

export async function getPlatformStats() {
  const [{ count: providers }, { count: clients }, { count: transactions }] = await Promise.all([
    supabase.from('fournisseurs').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
  ])

  return {
    totalProviders: providers ?? 0,
    totalClients: clients ?? 0,
    totalTransactions: transactions ?? 0,
    mau: clients ?? 0,
    dauMauRatio: clients ? 0.25 : 0,
    revenueByTier: [
      { tier: 'free', value: 0 },
      { tier: 'starter', value: 9 },
      { tier: 'premium', value: 29 },
      { tier: 'enterprise', value: 99 },
    ],
    geographicDistribution: [],
  }
}

export async function getSegmentDistribution() {
  const { data, error } = await supabase.rpc('get_segment_distribution')
  if (error) {
    throw error
  }

  return (data ?? []) as Array<{ segment_type: string; total: number }>
}

export async function getProviderHealthScores() {
  const { data: providers } = await supabase
    .from('fournisseurs')
    .select('id, nom_commerce, tier')

  return (providers ?? []).map((provider) => ({
    fournisseur_id: String(provider.id),
    nom_commerce: String(provider.nom_commerce),
    tier: String(provider.tier ?? 'free'),
    health_score: 75,
  }))
}

export async function getDataAssetValue() {
  const { data: consents } = await supabase
    .from('user_consents')
    .select('consent_type, granted')

  const grouped = {
    analytics: 0,
    marketing: 0,
    third_party: 0,
  }

  for (const row of consents ?? []) {
    const type = row.consent_type as 'analytics' | 'marketing' | 'third_party' | 'essential'
    if (type in grouped && row.granted) {
      grouped[type as keyof typeof grouped] += 1
    }
  }

  const dataPointsCollected = grouped.analytics * 120
  const estimatedValue = dataPointsCollected * 0.05

  return {
    ...grouped,
    dataPointsCollected,
    estimatedValue,
  }
}

export type AdminJobLog = {
  id: string
  job_name: string
  status: 'success' | 'failed'
  records_processed: number | null
  duration_ms: number | null
  created_at: string
}

export async function getRecentJobsLog(limit = 20): Promise<AdminJobLog[]> {
  const { data, error } = await supabase
    .from('jobs_log')
    .select('id, job_name, status, records_processed, duration_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as AdminJobLog[]
}

export async function runDailyJobsNow() {
  const { data, error } = await supabase.functions.invoke('daily-jobs', {
    method: 'POST',
  })

  if (error) {
    throw error
  }

  return data as { ok: boolean; jobs: Array<{ name: string; status: 'success' | 'failed' }> }
}

export async function getMySegment() {
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData?.session) {
    return { segment_type: 'unknown', segment_data: {}, score: null }
  }

  const { data, error } = await supabase.functions.invoke('get-my-segment', { method: 'GET' })
  if (error) {
    const status = (error as { context?: { status?: number } })?.context?.status
    const message = error.message.toLowerCase()

    if (status === 401 || status === 403 || message.includes('unauthorized') || message.includes('forbidden')) {
      return { segment_type: 'unknown', segment_data: {}, score: null }
    }

    throw error
  }

  return data as { segment_type: string; segment_data: Record<string, unknown>; score: number | null }
}

async function getChurnList(fournisseur_id: string) {
  const { data, error } = await supabase.rpc('detect_churn_risk', { p_fournisseur_id: fournisseur_id })
  if (error) {
    return []
  }

  return (data ?? []) as Array<{ client_id: string }>
}

function getSinceDate(period: Period): Date {
  const now = new Date()

  if (period === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }

  if (period === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  if (period === '90d') {
    return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  }

  return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
}

function formatBucket(date: Date, granularity: 'daily' | 'weekly' | 'monthly') {
  if (granularity === 'daily') {
    return date.toISOString().slice(0, 10)
  }

  if (granularity === 'weekly') {
    const week = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-W${week}`
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getTopKey(map: Map<number, number>) {
  let bestKey = 0
  let bestValue = -1

  for (const [key, value] of map.entries()) {
    if (value > bestValue) {
      bestKey = key
      bestValue = value
    }
  }

  return bestKey
}
