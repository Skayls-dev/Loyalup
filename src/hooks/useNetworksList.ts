import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export type NetworkStatus = 'active' | 'paused' | 'draft'

export interface NetworkListItem {
  id: string
  emoji: string
  name: string
  description: string
  multiplier: number
  merchantCount: number
  memberCount: number
  dailyPoints: number
  retentionPct: number
  status: NetworkStatus
  primaryColor: string
}

export interface NetworksListStats {
  activeNetworks: number
  totalMerchants: number
  activeUsers: number
  pointsDistributed: number
}

export interface UseNetworksListResult {
  networks: NetworkListItem[]
  stats: NetworksListStats
  loading: boolean
  error: string | null
}

type NetworkRow = {
  id: string
  emoji: string | null
  name: unknown
  description: unknown
  points_multiplier: number | null
  primary_color: string | null
  is_active: boolean | null
  is_draft: boolean | null
  member_count: number | null
  client_count: number | null
}

const EMPTY_STATS: NetworksListStats = {
  activeNetworks: 0,
  totalMerchants: 0,
  activeUsers: 0,
  pointsDistributed: 0,
}

function toLocalizedString(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim()) return raw

  if (raw && typeof raw === 'object') {
    const object = raw as { fr?: unknown; en?: unknown }
    if (typeof object.fr === 'string' && object.fr.trim()) return object.fr
    if (typeof object.en === 'string' && object.en.trim()) return object.en
  }

  return fallback
}

function resolveStatus(row: NetworkRow): NetworkStatus {
  if (Boolean(row.is_draft)) return 'draft'
  if (Boolean(row.is_active)) return 'active'
  return 'paused'
}

async function loadMerchantCounts(networkIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (networkIds.length === 0) return result

  const primary = await supabase.from('merchant_networks').select('network_id, merchant_id').in('network_id', networkIds)
  if (!primary.error) {
    for (const row of (primary.data ?? []) as Array<{ network_id: string; merchant_id: string }>) {
      const key = `${row.network_id}:${row.merchant_id}`
      result.set(key, 1)
    }

    const aggregated = new Map<string, number>()
    for (const key of result.keys()) {
      const [networkId] = key.split(':')
      aggregated.set(networkId, (aggregated.get(networkId) ?? 0) + 1)
    }

    return aggregated
  }

  const fallback = await supabase
    .from('network_members')
    .select('network_id, fournisseur_id, status')
    .in('network_id', networkIds)
    .eq('status', 'active')

  if (fallback.error) {
    return new Map<string, number>()
  }

  const seen = new Set<string>()
  const aggregated = new Map<string, number>()
  for (const row of (fallback.data ?? []) as Array<{ network_id: string; fournisseur_id: string }>) {
    const key = `${row.network_id}:${row.fournisseur_id}`
    if (seen.has(key)) continue
    seen.add(key)
    aggregated.set(row.network_id, (aggregated.get(row.network_id) ?? 0) + 1)
  }

  return aggregated
}

async function loadMemberCounts(networkIds: string[]): Promise<Map<string, number>> {
  if (networkIds.length === 0) return new Map<string, number>()

  const primary = await supabase.from('user_networks').select('network_id, user_id').in('network_id', networkIds)

  if (!primary.error) {
    const seen = new Set<string>()
    const aggregated = new Map<string, number>()
    for (const row of (primary.data ?? []) as Array<{ network_id: string; user_id: string }>) {
      const key = `${row.network_id}:${row.user_id}`
      if (seen.has(key)) continue
      seen.add(key)
      aggregated.set(row.network_id, (aggregated.get(row.network_id) ?? 0) + 1)
    }
    return aggregated
  }

  const fallback = await supabase.from('network_clients').select('network_id, client_id').in('network_id', networkIds)
  if (fallback.error) return new Map<string, number>()

  const seen = new Set<string>()
  const aggregated = new Map<string, number>()
  for (const row of (fallback.data ?? []) as Array<{ network_id: string; client_id: string }>) {
    const key = `${row.network_id}:${row.client_id}`
    if (seen.has(key)) continue
    seen.add(key)
    aggregated.set(row.network_id, (aggregated.get(row.network_id) ?? 0) + 1)
  }

  return aggregated
}

async function loadDailyPoints(networkIds: string[]): Promise<Map<string, number>> {
  if (networkIds.length === 0) return new Map<string, number>()

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const txRes = await supabase
    .from('transactions')
    .select('network_id, points, points_credited, created_at')
    .in('network_id', networkIds)
    .gte('created_at', since)

  if (!txRes.error) {
    const totals = new Map<string, number>()
    for (const row of (txRes.data ?? []) as Array<{ network_id: string; points?: number | null; points_credited?: number | null }>) {
      const amount = Number(row.points ?? row.points_credited ?? 0)
      totals.set(row.network_id, (totals.get(row.network_id) ?? 0) + amount)
    }
    return totals
  }

  const fallback = await supabase
    .from('network_point_events')
    .select('network_id, base_points, bonus_points, created_at')
    .in('network_id', networkIds)
    .gte('created_at', since)

  if (fallback.error) return new Map<string, number>()

  const totals = new Map<string, number>()
  for (const row of (fallback.data ?? []) as Array<{ network_id: string; base_points: number | null; bonus_points: number | null }>) {
    const points = Number(row.base_points ?? 0) + Number(row.bonus_points ?? 0)
    totals.set(row.network_id, (totals.get(row.network_id) ?? 0) + points)
  }

  return totals
}

async function loadRetention(networkIds: string[]): Promise<Map<string, number>> {
  if (networkIds.length === 0) return new Map<string, number>()

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const rowsRes = await supabase
    .from('network_clients')
    .select('network_id, last_activity_at')
    .in('network_id', networkIds)

  if (rowsRes.error) return new Map<string, number>()

  const total = new Map<string, number>()
  const active = new Map<string, number>()

  for (const row of (rowsRes.data ?? []) as Array<{ network_id: string; last_activity_at: string | null }>) {
    total.set(row.network_id, (total.get(row.network_id) ?? 0) + 1)
    if (row.last_activity_at && row.last_activity_at >= since) {
      active.set(row.network_id, (active.get(row.network_id) ?? 0) + 1)
    }
  }

  const ratios = new Map<string, number>()
  for (const [networkId, count] of total) {
    const activeCount = active.get(networkId) ?? 0
    ratios.set(networkId, count > 0 ? Math.round((activeCount / count) * 100) : 0)
  }

  return ratios
}

export function useNetworksList(): UseNetworksListResult {
  const [networks, setNetworks] = useState<NetworkListItem[]>([])
  const [stats, setStats] = useState<NetworksListStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      const { data, error: networksError } = await supabase
        .from('networks')
        .select('id, emoji, name, description, points_multiplier, primary_color, is_active, is_draft, member_count, client_count')
        .order('is_featured', { ascending: false })
        .order('member_count', { ascending: false })

      if (cancelled) return

      if (networksError) {
        setLoading(false)
        setError(networksError.message)
        setNetworks([])
        setStats(EMPTY_STATS)
        return
      }

      const baseRows = (data ?? []) as NetworkRow[]
      const ids = baseRows.map((row) => row.id)

      const [merchantCounts, memberCounts, dailyPoints, retentionPct] = await Promise.all([
        loadMerchantCounts(ids),
        loadMemberCounts(ids),
        loadDailyPoints(ids),
        loadRetention(ids),
      ])

      if (cancelled) return

      const mapped = baseRows.map((row) => {
        const merchantCount = merchantCounts.get(row.id) ?? Number(row.member_count ?? 0)
        const memberCount = memberCounts.get(row.id) ?? Number(row.client_count ?? 0)

        return {
          id: row.id,
          emoji: row.emoji?.trim() || '🌐',
          name: toLocalizedString(row.name, 'Réseau'),
          description: toLocalizedString(row.description, 'Description indisponible'),
          multiplier: Number(row.points_multiplier ?? 1),
          merchantCount,
          memberCount,
          dailyPoints: Math.round(dailyPoints.get(row.id) ?? 0),
          retentionPct: retentionPct.get(row.id) ?? 0,
          status: resolveStatus(row),
          primaryColor: row.primary_color?.trim() || '#5B4FE8',
        } satisfies NetworkListItem
      })

      const computedStats: NetworksListStats = {
        activeNetworks: mapped.filter((row) => row.status === 'active').length,
        totalMerchants: mapped.reduce((sum, row) => sum + row.merchantCount, 0),
        activeUsers: mapped.reduce((sum, row) => sum + row.memberCount, 0),
        pointsDistributed: mapped.reduce((sum, row) => sum + row.dailyPoints, 0),
      }

      setNetworks(mapped)
      setStats(computedStats)
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => ({ networks, stats, loading, error }), [networks, stats, loading, error])
}
