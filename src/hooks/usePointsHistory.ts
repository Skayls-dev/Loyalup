import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export interface PointsHistoryItem {
  week: string
  points: number
  isLatest?: boolean
}

export interface UsePointsHistoryResult {
  data: PointsHistoryItem[]
  loading: boolean
  error: string | null
}

function getWeekStart(input: Date): Date {
  const date = new Date(input)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function toWeekKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toWeekLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function usePointsHistory(userId?: string, weeks = 8): UsePointsHistoryResult {
  const [data, setData] = useState<PointsHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
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
        const safeWeeks = Math.max(1, weeks)
        const now = new Date()
        const currentWeekStart = getWeekStart(now)

        const weekStarts = Array.from({ length: safeWeeks }, (_, index) => {
          const date = new Date(currentWeekStart)
          date.setDate(currentWeekStart.getDate() - (safeWeeks - 1 - index) * 7)
          return date
        })

        const oldestWeekStart = weekStarts[0]

        // Equivalent aggregation to SQL GROUP BY week, adapted to current schema fields.
        const { data: rows, error: fetchError } = await supabase
          .from('transactions')
          .select('created_at, points_credited')
          .eq('client_id', userId)
          .eq('status', 'validated')
          .gte('created_at', oldestWeekStart.toISOString())
          .order('created_at', { ascending: true })

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        const sumByWeek = new Map<string, number>()

        for (const row of rows ?? []) {
          const createdAtRaw = row.created_at
          if (!createdAtRaw) {
            continue
          }

          const createdAt = new Date(createdAtRaw)
          if (Number.isNaN(createdAt.getTime())) {
            continue
          }

          const weekStart = getWeekStart(createdAt)
          const key = toWeekKey(weekStart)
          const points = Number(row.points_credited ?? 0)
          sumByWeek.set(key, (sumByWeek.get(key) ?? 0) + points)
        }

        const normalized: PointsHistoryItem[] = weekStarts.map((weekStart, index) => {
          const key = toWeekKey(weekStart)
          return {
            week: toWeekLabel(weekStart),
            points: Math.round(sumByWeek.get(key) ?? 0),
            isLatest: index === weekStarts.length - 1,
          }
        })

        if (!cancelled) {
          setData(normalized)
          setLoading(false)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setData([])
          setLoading(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger l\'historique points')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [userId, weeks])

  return useMemo(
    () => ({
      data,
      loading,
      error,
    }),
    [data, loading, error],
  )
}
