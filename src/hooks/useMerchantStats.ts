import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export interface MerchantStats {
  monthlyRevenue: number
  monthlyRevenueGrowthPercent: number
  monthlyPointsDistributed: number
  multiplierLabel: string
  loyalCustomers: number
  newCustomersThisMonth: number
  retentionRate: number
  averageRating: number
  ratingCount: number
}

export interface UseMerchantStatsResult {
  stats: MerchantStats
  loading: boolean
  error: string | null
}

const defaultStats: MerchantStats = {
  monthlyRevenue: 0,
  monthlyRevenueGrowthPercent: 0,
  monthlyPointsDistributed: 0,
  multiplierLabel: 'x2.0 Africa',
  loyalCustomers: 0,
  newCustomersThisMonth: 0,
  retentionRate: 0,
  averageRating: 0,
  ratingCount: 0,
}

type MerchantTransactionRow = {
  client_id: string | null
  montant: number | null
  points_credited: number | null
  created_at: string
}

type MerchantRatingRow = {
  rating: number | null
}

function monthStart(date: Date): Date {
  const value = new Date(date)
  value.setDate(1)
  value.setHours(0, 0, 0, 0)
  return value
}

export function useMerchantStats(merchantId: string): UseMerchantStatsResult {
  const [stats, setStats] = useState<MerchantStats>(defaultStats)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!merchantId) {
      setStats(defaultStats)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const now = new Date()
        const startCurrentMonth = monthStart(now)
        const startPreviousMonth = monthStart(new Date(now.getFullYear(), now.getMonth() - 1, 1))

        const [currentMonthRes, previousMonthRes, preCurrentMonthRes, ratingsRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('client_id, montant, points_credited, created_at')
            .eq('fournisseur_id', merchantId)
            .eq('status', 'validated')
            .gte('created_at', startCurrentMonth.toISOString()),
          supabase
            .from('transactions')
            .select('client_id, montant')
            .eq('fournisseur_id', merchantId)
            .eq('status', 'validated')
            .gte('created_at', startPreviousMonth.toISOString())
            .lt('created_at', startCurrentMonth.toISOString()),
          supabase
            .from('transactions')
            .select('client_id')
            .eq('fournisseur_id', merchantId)
            .eq('status', 'validated')
            .lt('created_at', startCurrentMonth.toISOString()),
          supabase
            .from('merchant_ratings')
            .select('rating')
            .eq('fournisseur_id', merchantId),
        ])

        if (currentMonthRes.error) throw new Error(currentMonthRes.error.message)
        if (previousMonthRes.error) throw new Error(previousMonthRes.error.message)
        if (preCurrentMonthRes.error) throw new Error(preCurrentMonthRes.error.message)
        if (ratingsRes.error) throw new Error(ratingsRes.error.message)

        const currentMonthRows = (currentMonthRes.data ?? []) as MerchantTransactionRow[]
        const previousMonthRows = (previousMonthRes.data ?? []) as Array<{ client_id: string | null; montant: number | null }>

        const monthlyRevenue = currentMonthRows.reduce((sum, row) => sum + Number(row.montant ?? 0), 0)
        const previousMonthRevenue = previousMonthRows.reduce((sum, row) => sum + Number(row.montant ?? 0), 0)
        const monthlyPointsDistributed = currentMonthRows.reduce((sum, row) => sum + Number(row.points_credited ?? 0), 0)

        const revenueGrowth =
          previousMonthRevenue > 0
            ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
            : monthlyRevenue > 0
              ? 100
              : 0

        const monthlyClients = new Set(currentMonthRows.map((row) => row.client_id).filter(Boolean) as string[])
        const previousClients = new Set((preCurrentMonthRes.data ?? []).map((row) => row.client_id).filter(Boolean) as string[])
        const ratingRows = (ratingsRes.data ?? []) as MerchantRatingRow[]

        const newCustomersThisMonth = [...monthlyClients].filter((clientId) => !previousClients.has(clientId)).length

        const visitsByClient = new Map<string, number>()
        for (const row of currentMonthRows) {
          if (!row.client_id) continue
          visitsByClient.set(row.client_id, (visitsByClient.get(row.client_id) ?? 0) + 1)
        }

        const loyalCustomers = [...visitsByClient.values()].filter((count) => count >= 2).length
        const totalCustomers = monthlyClients.size
        const retentionRate = totalCustomers > 0 ? (loyalCustomers / totalCustomers) * 100 : 0
        const normalizedRatings = ratingRows
          .map((row) => Number(row.rating ?? 0))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5)
        const ratingCount = normalizedRatings.length
        const averageRating = ratingCount > 0
          ? Math.round((normalizedRatings.reduce((sum, value) => sum + value, 0) / ratingCount) * 10) / 10
          : 0

        if (!cancelled) {
          setStats({
            monthlyRevenue,
            monthlyRevenueGrowthPercent: Math.round(revenueGrowth),
            monthlyPointsDistributed,
            multiplierLabel: 'x2.0 Africa',
            loyalCustomers,
            newCustomersThisMonth,
            retentionRate: Math.round(retentionRate),
            averageRating,
            ratingCount,
          })
          setLoading(false)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setStats(defaultStats)
          setLoading(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger les stats marchand')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [merchantId])

  return useMemo(() => ({ stats, loading, error }), [stats, loading, error])
}
