import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'
import { useAuth } from '../modules/auth/hooks/useAuth'

export interface DashboardStats {
  totalPoints: number
  pointsDeltaWeek: number
  activeNetworks: number
  monthlyTransactions: number
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  progressToNextTier: number
  activeNetworkName: string
  loading: boolean
  error: string | null
}

const defaultStats: DashboardStats = {
  totalPoints: 0,
  pointsDeltaWeek: 0,
  activeNetworks: 0,
  monthlyTransactions: 0,
  tier: 'Gold',
  progressToNextTier: 68,
  activeNetworkName: 'Brussels Local',
  loading: true,
  error: null,
}

function getTier(points: number): DashboardStats['tier'] {
  if (points >= 10000) return 'Platinum'
  if (points >= 6000) return 'Gold'
  if (points >= 2500) return 'Silver'
  return 'Bronze'
}

function computeProgressToNext(points: number): number {
  const ranges = [
    { min: 0, max: 2500 },
    { min: 2500, max: 6000 },
    { min: 6000, max: 10000 },
    { min: 10000, max: 15000 },
  ]

  const range = ranges.find((r) => points >= r.min && points < r.max) ?? ranges[ranges.length - 1]
  const denominator = Math.max(1, range.max - range.min)
  const pct = ((points - range.min) / denominator) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

export function useDashboardStats(): DashboardStats {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>(defaultStats)

  useEffect(() => {
    if (!user?.id) {
      setStats((prev) => ({ ...prev, loading: false }))
      return
    }
    const userId = user.id

    let cancelled = false

    async function run() {
      try {
        const startOfWeek = new Date()
        startOfWeek.setDate(startOfWeek.getDate() - 7)

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        // Equivalent to SELECT SUM(points) ... using existing points_credited field in this schema.
        const [pointsRes, weeklyRes, networksCountRes, monthlyTxRes, activeNetworkRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('points_credited')
            .eq('client_id', userId)
            .eq('status', 'validated'),
          supabase
            .from('transactions')
            .select('points_credited')
            .eq('client_id', userId)
            .eq('status', 'validated')
            .gte('created_at', startOfWeek.toISOString()),
          supabase
            .from('user_networks')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', userId)
            .eq('status', 'validated')
            .gte('created_at', startOfMonth.toISOString()),
          supabase
            .from('user_networks')
            .select('network_name')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle(),
        ])

        if (pointsRes.error) {
          throw new Error(pointsRes.error.message)
        }
        if (weeklyRes.error) {
          throw new Error(weeklyRes.error.message)
        }
        if (networksCountRes.error) {
          throw new Error(networksCountRes.error.message)
        }
        if (monthlyTxRes.error) {
          throw new Error(monthlyTxRes.error.message)
        }

        const totalPoints = (pointsRes.data ?? []).reduce((sum, row) => sum + Number(row.points_credited ?? 0), 0)
        const pointsDeltaWeek = (weeklyRes.data ?? []).reduce((sum, row) => sum + Number(row.points_credited ?? 0), 0)
        const activeNetworks = networksCountRes.count ?? 0
        const monthlyTransactions = monthlyTxRes.count ?? 0
        const tier = getTier(totalPoints)
        const progressToNextTier = computeProgressToNext(totalPoints)

        const activeNetworkName =
          !activeNetworkRes.error && activeNetworkRes.data?.network_name
            ? String(activeNetworkRes.data.network_name)
            : defaultStats.activeNetworkName

        if (!cancelled) {
          setStats({
            totalPoints,
            pointsDeltaWeek,
            activeNetworks,
            monthlyTransactions,
            tier,
            progressToNextTier,
            activeNetworkName,
            loading: false,
            error: null,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setStats((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Impossible de charger le dashboard',
          }))
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  return useMemo(() => stats, [stats])
}
