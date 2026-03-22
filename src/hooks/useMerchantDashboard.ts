import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../shared/lib/supabaseClient'
import type {
  MerchantActiveOffer,
  MerchantDashboardData,
  MerchantNetworkSummary,
  MerchantRecentTransaction,
  MerchantRevenueChart,
  MerchantRevenuePoint,
  MerchantStats,
  MerchantTier,
  MerchantTopCustomer,
  UseMerchantDashboardResult,
} from '../types/merchant'

const STALE_TIME_MS = 30_000

const EMPTY_DATA: MerchantDashboardData = {
  stats: {
    revenue: 0,
    points_given: 0,
    unique_customers: 0,
    retention_rate: 0,
  },
  revenueChart: {
    period_days: 30,
    daily: [],
    weekly: [],
  },
  recentTransactions: [],
  activeOffers: [],
  networks: [],
  topCustomers: [],
}

type TransactionRow = {
  id: string
  client_id: string | null
  montant: number | null
  points_credited: number | null
  created_at: string
  status?: string | null
}

function tierFromLevel(level: number): MerchantTier {
  if (level >= 8) return 'Gold'
  if (level >= 4) return 'Silver'
  return 'Bronze'
}

function profileName(profile: { nom?: string | null } | undefined, userId: string): string {
  if (profile?.nom?.trim()) return profile.nom.trim()
  return `Client ${userId.slice(0, 6)}`
}

function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayStart(date: Date): Date {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function weekStart(date: Date): Date {
  const d = dayStart(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function buildDailyChart(rows: TransactionRow[], days = 30): MerchantRevenuePoint[] {
  const today = dayStart(new Date())

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - 1 - i))
    const start = dayStart(date)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)

    const values = rows.filter((row) => {
      const created = new Date(row.created_at)
      return created >= start && created <= end
    })

    return {
      key: isoDate(start),
      label: start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      revenue: values.reduce((sum, row) => sum + Number(row.montant ?? 0), 0),
      points_given: values.reduce((sum, row) => sum + Number(row.points_credited ?? 0), 0),
    }
  })
}

function buildWeeklyChart(rows: TransactionRow[], days = 30): MerchantRevenuePoint[] {
  const now = new Date()
  const rangeStart = dayStart(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000))
  const firstWeek = weekStart(rangeStart)
  const currentWeek = weekStart(now)

  const buckets: Array<{ start: Date; end: Date }> = []
  for (let cursor = new Date(firstWeek); cursor <= currentWeek; cursor.setDate(cursor.getDate() + 7)) {
    const start = dayStart(new Date(cursor))
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    buckets.push({ start, end })
  }

  return buckets.map((bucket) => {
    const values = rows.filter((row) => {
      const created = new Date(row.created_at)
      return created >= bucket.start && created <= bucket.end
    })

    return {
      key: isoDate(bucket.start),
      label: bucket.start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      revenue: values.reduce((sum, row) => sum + Number(row.montant ?? 0), 0),
      points_given: values.reduce((sum, row) => sum + Number(row.points_credited ?? 0), 0),
    }
  })
}

async function fetchStats(merchantId: string): Promise<MerchantStats> {
  const { data, error } = await supabase
    .from('transactions')
    .select('client_id, montant, points_credited')
    .eq('fournisseur_id', merchantId)
    .eq('status', 'validated')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{ client_id: string | null; montant: number | null; points_credited: number | null }>
  const revenue = rows.reduce((sum, row) => sum + Number(row.montant ?? 0), 0)
  const pointsGiven = rows.reduce((sum, row) => sum + Number(row.points_credited ?? 0), 0)

  const visitCounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.client_id) continue
    visitCounts.set(row.client_id, (visitCounts.get(row.client_id) ?? 0) + 1)
  }

  const uniqueCustomers = visitCounts.size
  const usersWith2PlusVisits = [...visitCounts.values()].filter((count) => count >= 2).length
  const retentionRate = uniqueCustomers > 0 ? (usersWith2PlusVisits / uniqueCustomers) * 100 : 0

  return {
    revenue,
    points_given: pointsGiven,
    unique_customers: uniqueCustomers,
    retention_rate: Math.round(retentionRate * 100) / 100,
  }
}

async function fetchRevenueChart(merchantId: string): Promise<MerchantRevenueChart> {
  const since = dayStart(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000))

  const { data, error } = await supabase
    .from('transactions')
    .select('id, client_id, montant, points_credited, created_at, status')
    .eq('fournisseur_id', merchantId)
    .eq('status', 'validated')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as TransactionRow[]
  return {
    period_days: 30,
    daily: buildDailyChart(rows, 30),
    weekly: buildWeeklyChart(rows, 30),
  }
}

async function fetchRecentTransactions(merchantId: string): Promise<MerchantRecentTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, client_id, montant, points_credited, created_at, status')
    .eq('fournisseur_id', merchantId)
    .eq('status', 'validated')
    .order('created_at', { ascending: false })
    .limit(4)

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as TransactionRow[]
  const userIds = [...new Set(rows.map((row) => row.client_id).filter(Boolean))] as string[]

  const [profilesRes, levelsRes, userNetworksRes] = await Promise.all([
    userIds.length ? supabase.from('profiles').select('id, nom').in('id', userIds) : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from('client_levels').select('client_id, current_level').in('client_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from('network_clients').select('client_id, network_id, networks:network_id(name)').in('client_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (profilesRes.error) throw new Error(profilesRes.error.message)
  if (levelsRes.error) throw new Error(levelsRes.error.message)
  if (userNetworksRes.error) throw new Error(userNetworksRes.error.message)

  const profileMap = new Map<string, { nom?: string | null }>()
  for (const row of (profilesRes.data ?? []) as Array<{ id: string; nom?: string | null }>) {
    profileMap.set(row.id, { nom: row.nom ?? null })
  }

  const tierMap = new Map<string, MerchantTier>()
  for (const row of (levelsRes.data ?? []) as Array<{ client_id: string; current_level: number | null }>) {
    tierMap.set(row.client_id, tierFromLevel(Number(row.current_level ?? 1)))
  }

  const networkMap = new Map<string, { id: string | null; name: string }>()
  for (const row of (userNetworksRes.data ?? []) as Array<{ client_id: string; network_id: string | null; networks?: unknown }>) {
    if (networkMap.has(row.client_id)) continue
    const raw = row.networks
    const first = Array.isArray(raw) ? raw[0] : raw
    const name = first && typeof first === 'object' ? (first as { name?: unknown }).name : null
    const label = typeof name === 'string' ? name : 'Reseau LoyalUp'
    networkMap.set(row.client_id, { id: row.network_id ?? null, name: label })
  }

  return rows.map((row) => {
    const userId = row.client_id ?? 'unknown'
    const network = networkMap.get(userId)

    return {
      id: row.id,
      user_id: userId,
      user_name: profileName(profileMap.get(userId), userId),
      tier: tierMap.get(userId) ?? 'Bronze',
      network_id: network?.id ?? null,
      network_name: network?.name ?? 'Reseau LoyalUp',
      points_given: Number(row.points_credited ?? 0),
      amount: Number(row.montant ?? 0),
      created_at: row.created_at,
    }
  })
}

async function fetchActiveOffers(merchantId: string): Promise<MerchantActiveOffer[]> {
  const { data, error } = await supabase
    .from('reward_rules')
    .select('id, nom, description, points_required, emoji, actif, expiry_date, created_at')
    .eq('fournisseur_id', merchantId)
    .eq('actif', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const ruleRows = (data ?? []) as Array<Record<string, unknown>>
  const ruleIds = ruleRows
    .map((row) => String(row.id ?? ''))
    .filter((id) => id.length > 0)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const redemptionCounts = new Map<string, number>()
  if (ruleIds.length > 0) {
    const redemptionsRes = await supabase
      .from('client_rewards')
      .select('reward_rule_id')
      .in('reward_rule_id', ruleIds)
      .eq('status', 'used')
      .gte('used_at', startOfMonth.toISOString())

    if (redemptionsRes.error) throw new Error(redemptionsRes.error.message)

    for (const row of (redemptionsRes.data ?? []) as Array<{ reward_rule_id: string | null }>) {
      if (!row.reward_rule_id) continue
      redemptionCounts.set(row.reward_rule_id, (redemptionCounts.get(row.reward_rule_id) ?? 0) + 1)
    }
  }

  return ruleRows
    .map((row) => {
      const today = new Date().toISOString().slice(0, 10)
      const expiryDate = typeof row.expiry_date === 'string' ? row.expiry_date : null
      const status: 'active' | 'paused' | 'expired' = expiryDate && expiryDate < today
        ? 'expired'
        : row.actif === false
          ? 'paused'
          : 'active'
      const id = String(row.id ?? '')

      return {
        id,
        name: String(row.nom ?? 'Offre'),
        description: typeof row.description === 'string' ? row.description : null,
        points_required: Number(row.points_required ?? 0),
        redemption_count: redemptionCounts.get(id) ?? 0,
        expiry_date: expiryDate,
        status,
        category: typeof row.emoji === 'string' ? row.emoji : null,
      } satisfies MerchantActiveOffer
    })
    .filter((offer) => offer.status === 'active')
}

async function fetchNetworks(merchantId: string): Promise<MerchantNetworkSummary[]> {
  const [joinedRes, txRes] = await Promise.all([
    supabase
      .from('network_members')
      .select('network_id, networks:network_id(id, name, emoji, points_multiplier, primary_color, secondary_color)')
      .eq('fournisseur_id', merchantId)
      .eq('status', 'active'),
    supabase
      .from('transactions')
      .select('client_id')
      .eq('fournisseur_id', merchantId)
      .eq('status', 'validated'),
  ])

  if (joinedRes.error) throw new Error(joinedRes.error.message)
  if (txRes.error) throw new Error(txRes.error.message)

  const baseNetworks = ((joinedRes.data ?? []) as Array<{ network_id: string; networks?: unknown }>)
    .map((row) => {
      const raw = row.networks
      const network = Array.isArray(raw) ? raw[0] : raw
      if (!network || typeof network !== 'object') return null

      const item = network as {
        id?: string
        name?: unknown
        emoji?: unknown
        points_multiplier?: unknown
        primary_color?: unknown
        secondary_color?: unknown
      }

      const nameValue = item.name
      const networkName =
        typeof nameValue === 'string'
          ? nameValue
          : nameValue && typeof nameValue === 'object'
            ? (typeof (nameValue as { fr?: unknown }).fr === 'string'
                ? String((nameValue as { fr: string }).fr)
                : typeof (nameValue as { en?: unknown }).en === 'string'
                  ? String((nameValue as { en: string }).en)
                  : 'Reseau')
            : 'Reseau'

      return {
        id: String(item.id ?? row.network_id),
        name: networkName,
        emoji: typeof item.emoji === 'string' ? item.emoji : '🌍',
        multiplier: Number(item.points_multiplier ?? 1),
        primary_color: typeof item.primary_color === 'string' ? item.primary_color : '#5B4FE8',
        secondary_color: typeof item.secondary_color === 'string' ? item.secondary_color : null,
        points_total: 0,
      } satisfies MerchantNetworkSummary
    })
    .filter((row): row is MerchantNetworkSummary => Boolean(row))

  const clientIds = [...new Set(((txRes.data ?? []) as Array<{ client_id: string | null }>).map((row) => row.client_id).filter(Boolean))] as string[]
  const networkIds = baseNetworks.map((network) => network.id)

  if (clientIds.length === 0 || networkIds.length === 0) {
    return baseNetworks
  }

  const userNetworksRes = await supabase
    .from('network_clients')
    .select('client_id, network_id, total_network_points')
    .in('client_id', clientIds)
    .in('network_id', networkIds)

  if (userNetworksRes.error) throw new Error(userNetworksRes.error.message)

  const totals = new Map<string, number>()
  for (const row of (userNetworksRes.data ?? []) as Array<{ network_id: string; total_network_points: number | null }>) {
    totals.set(row.network_id, (totals.get(row.network_id) ?? 0) + Number(row.total_network_points ?? 0))
  }

  return baseNetworks.map((network) => ({
    ...network,
    points_total: totals.get(network.id) ?? 0,
  }))
}

async function fetchTopCustomers(merchantId: string): Promise<MerchantTopCustomer[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('client_id, points_credited')
    .eq('fournisseur_id', merchantId)
    .eq('status', 'validated')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{ client_id: string | null; points_credited: number | null }>
  const pointsByUser = new Map<string, { points: number; visits: number }>()

  for (const row of rows) {
    if (!row.client_id) continue
    const current = pointsByUser.get(row.client_id) ?? { points: 0, visits: 0 }
    current.points += Number(row.points_credited ?? 0)
    current.visits += 1
    pointsByUser.set(row.client_id, current)
  }

  const topIds = [...pointsByUser.entries()]
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 4)
    .map(([userId]) => userId)

  if (topIds.length === 0) {
    return []
  }

  const [profilesRes, levelsRes] = await Promise.all([
    supabase.from('profiles').select('id, nom').in('id', topIds),
    supabase.from('client_levels').select('client_id, current_level').in('client_id', topIds),
  ])

  if (profilesRes.error) throw new Error(profilesRes.error.message)
  if (levelsRes.error) throw new Error(levelsRes.error.message)

  const profileMap = new Map<string, { nom?: string | null }>()
  for (const row of (profilesRes.data ?? []) as Array<{ id: string; nom?: string | null }>) {
    profileMap.set(row.id, { nom: row.nom ?? null })
  }

  const levelMap = new Map<string, number>()
  for (const row of (levelsRes.data ?? []) as Array<{ client_id: string; current_level: number | null }>) {
    levelMap.set(row.client_id, Number(row.current_level ?? 1))
  }

  return topIds.map((userId) => {
    const stats = pointsByUser.get(userId) ?? { points: 0, visits: 0 }
    return {
      user_id: userId,
      name: profileName(profileMap.get(userId), userId),
      tier: tierFromLevel(levelMap.get(userId) ?? 1),
      visits: stats.visits,
      points: stats.points,
    }
  })
}

async function fetchMerchantDashboard(merchantId: string): Promise<MerchantDashboardData> {
  const [stats, revenueChart, recentTransactions, activeOffers, networks, topCustomers] = await Promise.all([
    fetchStats(merchantId),
    fetchRevenueChart(merchantId),
    fetchRecentTransactions(merchantId),
    fetchActiveOffers(merchantId),
    fetchNetworks(merchantId),
    fetchTopCustomers(merchantId),
  ])

  return {
    stats,
    revenueChart,
    recentTransactions,
    activeOffers,
    networks,
    topCustomers,
  }
}

export function useMerchantDashboard(merchantId: string): UseMerchantDashboardResult {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: () => fetchMerchantDashboard(merchantId),
    enabled: Boolean(merchantId),
    staleTime: STALE_TIME_MS,
    initialData: EMPTY_DATA,
  })

  useEffect(() => {
    if (!merchantId) return

    const channel = supabase
      .channel('merchant-txns')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload) => {
          const row = payload.new as TransactionRow & { merchant_id?: string | null; fournisseur_id?: string | null }
          if (row.status && row.status !== 'validated') return

          queryClient.setQueryData<MerchantDashboardData>(['merchant', merchantId], (prev) => {
            if (!prev) return prev
            const userId = row.client_id ?? 'unknown'

            const nextRecent = [
              {
                id: row.id,
                user_id: userId,
                user_name: `Client ${userId.slice(0, 6)}`,
                tier: 'Bronze' as const,
                network_id: null,
                network_name: 'Reseau LoyalUp',
                points_given: Number(row.points_credited ?? 0),
                amount: Number(row.montant ?? 0),
                created_at: row.created_at,
              },
              ...prev.recentTransactions,
            ]
              .filter((tx, index, all) => all.findIndex((x) => x.id === tx.id) === index)
              .slice(0, 4)

            return {
              ...prev,
              stats: {
                ...prev.stats,
                revenue: prev.stats.revenue + Number(row.montant ?? 0),
                points_given: prev.stats.points_given + Number(row.points_credited ?? 0),
              },
              recentTransactions: nextRecent,
            }
          })

          void queryClient.invalidateQueries({ queryKey: ['merchant', merchantId], exact: true })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `fournisseur_id=eq.${merchantId}`,
        },
        (payload) => {
          const row = payload.new as TransactionRow
          if (row.status && row.status !== 'validated') return
          void queryClient.invalidateQueries({ queryKey: ['merchant', merchantId], exact: true })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [merchantId, queryClient])

  return useMemo(
    () => ({
      data: query.data ?? EMPTY_DATA,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      error: query.error instanceof Error ? query.error.message : null,
      refetch: query.refetch,
    }),
    [query.data, query.error, query.isFetching, query.isLoading, query.refetch],
  )
}
