import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export interface RecentTransactionItem {
  id: string
  merchantId: string | null
  merchantName: string
  merchantEmoji: string
  networkColor: string
  points: number
  createdAt: string
  transactionType: 'purchase' | 'reward_redemption'
  serviceName: string | null
  canRate: boolean
  ratingScore: number | null
}

export interface UseRecentTransactionsResult {
  transactions: RecentTransactionItem[]
  loading: boolean
  error: string | null
}

type TransactionRow = {
  id: string
  fournisseur_id: string | null
  points_credited: number | null
  created_at: string
  status: string | null
  transaction_type: string | null
  service_nom_libre: string | null
}

type RatingRow = {
  transaction_id: string
  rating: number | null
}

export function useRecentTransactions(userId?: string, limit = 4): UseRecentTransactionsResult {
  const [transactions, setTransactions] = useState<RecentTransactionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setTransactions([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        // Schema adaptation: transactions currently use client_id/fournisseur_id/points_credited.
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('id, fournisseur_id, points_credited, created_at, status, transaction_type, service_nom_libre')
          .eq('client_id', userId)
          .eq('status', 'validated')
          .order('created_at', { ascending: false })
          .limit(Math.max(1, limit))

        if (txError) {
          throw new Error(txError.message)
        }

        const rows = (txData ?? []) as TransactionRow[]
        const providerIds = [...new Set(rows.map((row) => row.fournisseur_id).filter(Boolean))] as string[]
        const transactionIds = rows.map((row) => row.id)

        const { data: providersData, error: providersError } = providerIds.length
          ? await supabase.from('fournisseurs').select('id, nom_commerce').in('id', providerIds)
          : { data: [], error: null }

        if (providersError) {
          throw new Error(providersError.message)
        }

        const { data: ratingsData, error: ratingsError } = transactionIds.length
          ? await supabase
              .from('merchant_ratings')
              .select('transaction_id, rating')
              .eq('client_id', userId)
              .in('transaction_id', transactionIds)
          : { data: [], error: null }

        if (ratingsError) {
          throw new Error(ratingsError.message)
        }

        const ratingMap = new Map<string, number>()
        for (const row of (ratingsData ?? []) as RatingRow[]) {
          ratingMap.set(row.transaction_id, Number(row.rating ?? 0))
        }

        const providerMap = new Map<string, string>()
        for (const provider of (providersData ?? []) as Array<{ id: string; nom_commerce?: string | null }>) {
          providerMap.set(provider.id, provider.nom_commerce?.trim() || 'Marchand')
        }

        const fallbackColors = ['#5B4FE8', '#00C9A7', '#FF6B35', '#FFD23F']

        const mapped: RecentTransactionItem[] = rows.map((row, index) => ({
          id: row.id,
          merchantId: row.fournisseur_id,
          merchantName: row.fournisseur_id ? providerMap.get(row.fournisseur_id) ?? 'Marchand' : 'Marchand',
          merchantEmoji: row.transaction_type === 'reward_redemption' ? '🎁' : '🏪',
          networkColor: fallbackColors[index % fallbackColors.length],
          points: Number(row.points_credited ?? 0),
          createdAt: row.created_at,
          transactionType: row.transaction_type === 'reward_redemption' ? 'reward_redemption' : 'purchase',
          serviceName: row.service_nom_libre ?? null,
          canRate:
            row.transaction_type !== 'reward_redemption'
            && Number(row.points_credited ?? 0) > 0
            && Boolean(row.fournisseur_id),
          ratingScore: ratingMap.get(row.id) ?? null,
        }))

        if (!cancelled) {
          setTransactions(mapped)
          setLoading(false)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setTransactions([])
          setLoading(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger les transactions')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [userId, limit])

  return useMemo(() => ({ transactions, loading, error }), [transactions, loading, error])
}
