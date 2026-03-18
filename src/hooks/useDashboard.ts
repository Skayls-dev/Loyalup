import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../shared/lib/supabaseClient'
import type {
  DashboardChallenge,
  DashboardNetwork,
  DashboardPayload,
  DashboardRecentTransaction,
  DashboardReward,
  DashboardStats,
  DashboardTier,
  DashboardTierLevel,
  UseDashboardResult,
} from '../types/dashboard'

const DASHBOARD_STALE_TIME_MS = 60_000

const DEFAULT_TIER: DashboardTier = {
  current: 'Bronze',
  currentThreshold: 0,
  next: 'Silver',
  nextThreshold: 2500,
  pointsToNext: 2500,
  progressPercent: 0,
}

const DEFAULT_PAYLOAD: DashboardPayload = {
  stats: {
    totalPoints: 0,
    activeNetworksCount: 0,
    monthlyTransactionsCount: 0,
    currentTier: 'Bronze',
  },
  networks: [],
  recentTransactions: [],
  challenges: [],
  rewards: [],
  tier: DEFAULT_TIER,
}

type TierStep = {
  level: DashboardTierLevel
  threshold: number
}

const TIER_STEPS: TierStep[] = [
  { level: 'Bronze', threshold: 0 },
  { level: 'Silver', threshold: 2500 },
  { level: 'Gold', threshold: 6000 },
  { level: 'Platinum', threshold: 10000 },
]

function resolveTier(totalPoints: number): DashboardTier {
  let current = TIER_STEPS[0]

  for (const step of TIER_STEPS) {
    if (totalPoints >= step.threshold) {
      current = step
    }
  }

  const currentIndex = TIER_STEPS.findIndex((step) => step.level === current.level)
  const next = currentIndex >= 0 ? TIER_STEPS[currentIndex + 1] ?? null : null

  if (!next) {
    return {
      current: current.level,
      currentThreshold: current.threshold,
      next: null,
      nextThreshold: null,
      pointsToNext: 0,
      progressPercent: 100,
    }
  }

  const denominator = Math.max(1, next.threshold - current.threshold)
  const progress = ((totalPoints - current.threshold) / denominator) * 100

  return {
    current: current.level,
    currentThreshold: current.threshold,
    next: next.level,
    nextThreshold: next.threshold,
    pointsToNext: Math.max(0, next.threshold - totalPoints),
    progressPercent: Math.max(0, Math.min(100, Math.round(progress))),
  }
}

function parseLocalizedText(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw
  }

  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>
    if (typeof rec.fr === 'string') return rec.fr
    if (typeof rec.en === 'string') return rec.en
  }

  return ''
}

async function fetchStats(userId: string): Promise<DashboardStats> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [pointsRes, activeNetworksRes, monthlyTransactionsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('points_credited')
      .eq('client_id', userId)
      .eq('status', 'validated'),
    supabase.from('user_networks').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', userId)
      .eq('status', 'validated')
      .gte('created_at', startOfMonth.toISOString()),
  ])

  if (pointsRes.error) throw new Error(pointsRes.error.message)
  if (activeNetworksRes.error) throw new Error(activeNetworksRes.error.message)
  if (monthlyTransactionsRes.error) throw new Error(monthlyTransactionsRes.error.message)

  const totalPoints = (pointsRes.data ?? []).reduce((sum, row) => sum + Number(row.points_credited ?? 0), 0)
  const tier = resolveTier(totalPoints)

  return {
    totalPoints,
    activeNetworksCount: activeNetworksRes.count ?? 0,
    monthlyTransactionsCount: monthlyTransactionsRes.count ?? 0,
    currentTier: tier.current,
  }
}

async function fetchNetworks(userId: string): Promise<DashboardNetwork[]> {
  const { data, error } = await supabase
    .from('user_networks')
    .select(
      `
      network_id,
      points,
      networks:network_id (
        id,
        name,
        emoji,
        merchant_count,
        network_config (
          bg_color,
          badge_color,
          multiplier,
          next_threshold
        )
      )
    `,
    )
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row) => {
      const networkRaw = row.networks as unknown
      const network = Array.isArray(networkRaw) ? networkRaw[0] : networkRaw
      if (!network || typeof network !== 'object') return null

      const cfgRaw = (network as { network_config?: unknown }).network_config
      const config = Array.isArray(cfgRaw) ? cfgRaw[0] : cfgRaw

      const points = Number((row as { points?: number }).points ?? 0)
      const nextThreshold = Math.max(1, Number((config as { next_threshold?: number })?.next_threshold ?? 1000))
      const progressPercent = Math.max(0, Math.min(100, Math.round((points / nextThreshold) * 100)))

      return {
        id: String((network as { id?: string }).id ?? (row as { network_id?: string }).network_id ?? ''),
        name: String((network as { name?: string }).name ?? 'Réseau'),
        emoji: String((network as { emoji?: string }).emoji ?? '🌐'),
        bgColor:
          typeof (config as { bg_color?: unknown })?.bg_color === 'string'
            ? String((config as { bg_color: string }).bg_color)
            : '#EBE9FF',
        badgeColor:
          typeof (config as { badge_color?: unknown })?.badge_color === 'string'
            ? String((config as { badge_color: string }).badge_color)
            : '#5B4FE8',
        points,
        merchantCount: Number((network as { merchant_count?: number }).merchant_count ?? 0),
        multiplier: Number((config as { multiplier?: number })?.multiplier ?? 1),
        nextThreshold,
        progressPercent,
      } satisfies DashboardNetwork
    })
    .filter((item): item is DashboardNetwork => item !== null)
}

async function fetchRecentTransactions(userId: string): Promise<DashboardRecentTransaction[]> {
  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .select('id, fournisseur_id, points_credited, created_at')
    .eq('client_id', userId)
    .eq('status', 'validated')
    .order('created_at', { ascending: false })
    .limit(4)

  if (txError) throw new Error(txError.message)

  const rows = (txData ?? []) as Array<{
    id: string
    fournisseur_id: string | null
    points_credited: number | null
    created_at: string
  }>

  const providerIds = [...new Set(rows.map((row) => row.fournisseur_id).filter(Boolean))] as string[]
  const providersRes = providerIds.length
    ? await supabase.from('fournisseurs').select('id, nom_commerce').in('id', providerIds)
    : { data: [], error: null }

  if (providersRes.error) throw new Error(providersRes.error.message)

  const providerMap = new Map<string, string>()
  for (const provider of (providersRes.data ?? []) as Array<{ id: string; nom_commerce?: string | null }>) {
    providerMap.set(provider.id, provider.nom_commerce?.trim() || 'Marchand')
  }

  const fallbackColors = ['#5B4FE8', '#00C9A7', '#FF6B35', '#FFD23F']

  return rows.map((row, index) => ({
    id: row.id,
    merchantName: row.fournisseur_id ? providerMap.get(row.fournisseur_id) ?? 'Marchand' : 'Marchand',
    merchantEmoji: '🏪',
    networkId: null,
    networkName: 'Réseau LoyalUp',
    networkColor: fallbackColors[index % fallbackColors.length],
    points: Number(row.points_credited ?? 0),
    createdAt: row.created_at,
  }))
}

async function fetchChallenges(userId: string): Promise<DashboardChallenge[]> {
  const nowIso = new Date().toISOString()

  const { data: activeData, error: activeError } = await supabase
    .from('challenges')
    .select('id, title, emoji, target_value, reward_points')
    .eq('is_active', true)
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .order('ends_at', { ascending: true })
    .limit(6)

  if (activeError) throw new Error(activeError.message)

  const activeRows = (activeData ?? []) as Array<{
    id: string
    title: unknown
    emoji: string | null
    target_value: number | null
    reward_points: number | null
  }>

  const challengeIds = activeRows.map((row) => row.id)
  const progressRes = challengeIds.length
    ? await supabase
        .from('client_challenge_progress')
        .select('challenge_id, current_value')
        .eq('client_id', userId)
        .in('challenge_id', challengeIds)
    : { data: [], error: null }

  if (progressRes.error) throw new Error(progressRes.error.message)

  const progressMap = new Map<string, number>()
  for (const progress of (progressRes.data ?? []) as Array<{ challenge_id: string; current_value: number | null }>) {
    progressMap.set(progress.challenge_id, Number(progress.current_value ?? 0))
  }

  return activeRows.map((row) => {
    const current = Number(progressMap.get(row.id) ?? 0)
    const target = Math.max(1, Number(row.target_value ?? 1))
    const progressPercent = Math.max(0, Math.min(100, Math.round((current / target) * 100)))

    return {
      id: row.id,
      icon: row.emoji?.trim() || '🎯',
      name: parseLocalizedText(row.title) || 'Défi',
      current,
      target,
      rewardPoints: Number(row.reward_points ?? 0),
      progressPercent,
    }
  })
}

async function fetchRewards(userId: string): Promise<DashboardReward[]> {
  const { data, error } = await supabase
    .from('client_rewards')
    .select(
      'id, fournisseur_id, reward_rule:reward_rules(id, nom, emoji, points_required), status, created_at',
    )
    .eq('client_id', userId)
    .eq('status', 'available')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    id: string
    fournisseur_id: string
    reward_rule: unknown
  }>

  const providerIds = [...new Set(rows.map((row) => row.fournisseur_id).filter(Boolean))]
  const providersRes = providerIds.length
    ? await supabase.from('fournisseurs').select('id, nom_commerce').in('id', providerIds)
    : { data: [], error: null }

  if (providersRes.error) throw new Error(providersRes.error.message)

  const providerMap = new Map<string, string>()
  for (const provider of (providersRes.data ?? []) as Array<{ id: string; nom_commerce?: string | null }>) {
    providerMap.set(provider.id, provider.nom_commerce?.trim() || 'Marchand')
  }

  const mapped: DashboardReward[] = rows
    .map((row) => {
      const rawRule = row.reward_rule as unknown
      const rule = Array.isArray(rawRule) ? rawRule[0] : rawRule
      if (!rule || typeof rule !== 'object') return null

      const name = String((rule as { nom?: string }).nom ?? 'Récompense')

      return {
        id: row.id,
        emoji: String((rule as { emoji?: string }).emoji ?? '🎁'),
        name,
        merchant: providerMap.get(row.fournisseur_id) ?? 'Marchand',
        costPoints: Number((rule as { points_required?: number }).points_required ?? 0),
        featured: /platinum/i.test(name),
      } satisfies DashboardReward
    })
    .filter((item): item is DashboardReward => item !== null)

  return mapped.sort((a, b) => a.costPoints - b.costPoints)
}

async function fetchDashboardPayload(userId: string): Promise<DashboardPayload> {
  const [stats, networks, recentTransactions, challenges, rewards] = await Promise.all([
    fetchStats(userId),
    fetchNetworks(userId),
    fetchRecentTransactions(userId),
    fetchChallenges(userId),
    fetchRewards(userId),
  ])

  const tier = resolveTier(stats.totalPoints)

  return {
    stats,
    networks,
    recentTransactions,
    challenges,
    rewards,
    tier,
  }
}

export function useDashboard(userId: string): UseDashboardResult {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => fetchDashboardPayload(userId),
    enabled: Boolean(userId),
    staleTime: DASHBOARD_STALE_TIME_MS,
  })

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`dashboard-transactions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `client_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard', userId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, userId])

  return useMemo(() => {
    const payload = query.data ?? DEFAULT_PAYLOAD

    return {
      ...payload,
      isLoading: query.isLoading || query.isFetching,
      error: query.error instanceof Error ? query.error.message : null,
    }
  }, [query.data, query.error, query.isFetching, query.isLoading])
}
