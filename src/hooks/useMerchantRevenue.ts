import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export type MerchantRevenuePeriod = '7d' | '30d' | '90d'

export interface MerchantRevenuePoint {
  key: string
  label: string
  revenue: number
  pointsDistributed: number
  isLatest: boolean
}

export interface UseMerchantRevenueResult {
  data: MerchantRevenuePoint[]
  loading: boolean
  error: string | null
}

type TransactionRow = {
  created_at: string
  montant: number | null
  points_credited: number | null
}

type Bucket = {
  start: Date
  end: Date
}

function startOfDay(date: Date): Date {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function startOfWeek(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const value = startOfDay(date)
  value.setDate(value.getDate() + diff)
  return value
}

function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toLabel(date: Date, weekly: boolean): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    ...(weekly ? { year: undefined } : {}),
  })
}

function buildBuckets(period: MerchantRevenuePeriod): Bucket[] {
  const now = new Date()
  const today = startOfDay(now)

  if (period === '90d') {
    const weekCount = 13
    const currentWeekStart = startOfWeek(today)
    return Array.from({ length: weekCount }, (_, index) => {
      const offset = weekCount - 1 - index
      const start = new Date(currentWeekStart)
      start.setDate(currentWeekStart.getDate() - offset * 7)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    })
  }

  const dayCount = period === '7d' ? 7 : 30
  return Array.from({ length: dayCount }, (_, index) => {
    const offset = dayCount - 1 - index
    const start = new Date(today)
    start.setDate(today.getDate() - offset)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  })
}

export function useMerchantRevenue(
  merchantId: string,
  period: MerchantRevenuePeriod,
): UseMerchantRevenueResult {
  const [data, setData] = useState<MerchantRevenuePoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!merchantId) {
      setData([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const buckets = buildBuckets(period)
        const oldestStart = buckets[0]?.start ?? new Date()

        // Schema adaptation: this project currently stores merchant transactions as
        // fournisseur_id / montant / points_credited.
        const { data: rowsData, error: rowsError } = await supabase
          .from('transactions')
          .select('created_at, montant, points_credited')
          .eq('fournisseur_id', merchantId)
          .eq('status', 'validated')
          .gte('created_at', oldestStart.toISOString())
          .order('created_at', { ascending: true })

        if (rowsError) {
          throw new Error(rowsError.message)
        }

        const rows = (rowsData ?? []) as TransactionRow[]

        const normalized = buckets.map((bucket, index) => {
          const values = rows.filter((row) => {
            const createdAt = new Date(row.created_at)
            return createdAt >= bucket.start && createdAt <= bucket.end
          })

          const revenue = values.reduce((sum, row) => sum + Number(row.montant ?? 0), 0)
          const pointsDistributed = values.reduce((sum, row) => sum + Number(row.points_credited ?? 0), 0)

          return {
            key: toISODate(bucket.start),
            label: toLabel(bucket.start, period === '90d'),
            revenue: Math.round(revenue),
            pointsDistributed: Math.round(pointsDistributed),
            isLatest: index === buckets.length - 1,
          } satisfies MerchantRevenuePoint
        })

        if (!cancelled) {
          setData(normalized)
          setLoading(false)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setData([])
          setLoading(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger le revenu marchand')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [merchantId, period])

  return useMemo(() => ({ data, loading, error }), [data, loading, error])
}
