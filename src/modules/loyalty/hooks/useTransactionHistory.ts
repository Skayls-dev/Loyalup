import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { getTransactionHistory, type TransactionHistoryItem } from '../services/loyaltyService'

type UseTransactionHistoryParams = {
  fournisseur_id?: string
}

type UseTransactionHistoryResult = {
  transactions: TransactionHistoryItem[]
  loading: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  error: string | null
  offline: boolean
}

const PAGE_SIZE = 20

const cacheKeyFor = (clientId: string, fournisseurId?: string) =>
  `loyalty:history:${clientId}:${fournisseurId ?? 'all'}`

export function useTransactionHistory({ fournisseur_id }: UseTransactionHistoryParams): UseTransactionHistoryResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const pageRef = useRef(0)
  const seenIdsRef = useRef<Set<string>>(new Set())

  const fetchPage = useCallback(
    async (page: number) => {
      if (!userId) {
        return []
      }

      const rows = await getTransactionHistory(userId, fournisseur_id, page, PAGE_SIZE)
      return rows.filter((row) => !seenIdsRef.current.has(row.id))
    },
    [fournisseur_id, userId],
  )

  const refresh = useCallback(async () => {
    if (!userId) {
      // Avoid wiping UI when auth state is temporarily rehydrating.
      if (authLoading) {
        return
      }

      setTransactions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    pageRef.current = 0
    seenIdsRef.current.clear()

    try {
      const rows = await fetchPage(0)
      rows.forEach((row) => seenIdsRef.current.add(row.id))
      setTransactions(rows)
      setHasMore(rows.length === PAGE_SIZE)
      localStorage.setItem(cacheKeyFor(userId, fournisseur_id), JSON.stringify(rows))
      setOffline(false)
    } catch (caughtError) {
      const cached = localStorage.getItem(cacheKeyFor(userId, fournisseur_id))
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as TransactionHistoryItem[]
          parsed.forEach((row) => seenIdsRef.current.add(row.id))
          setTransactions(parsed)
          setOffline(true)
        } catch {
          setTransactions([])
        }
      }

      const message = caughtError instanceof Error ? caughtError.message : 'Unable to load transaction history'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [authLoading, fetchPage, fournisseur_id, userId])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !userId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const nextPage = pageRef.current + 1
      const rows = await fetchPage(nextPage)
      rows.forEach((row) => seenIdsRef.current.add(row.id))

      setTransactions((prev) => [...prev, ...rows])
      pageRef.current = nextPage
      setHasMore(rows.length === PAGE_SIZE)
      setOffline(false)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to load more transactions'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [fetchPage, hasMore, loading, userId])

  useEffect(() => {
    refresh().catch(() => null)
  }, [refresh])

  useEffect(() => {
    const onStatus = () => setOffline(!navigator.onLine)
    window.addEventListener('online', onStatus)
    window.addEventListener('offline', onStatus)
    return () => {
      window.removeEventListener('online', onStatus)
      window.removeEventListener('offline', onStatus)
    }
  }, [])

  return useMemo(
    () => ({ transactions, loading, hasMore, loadMore, refresh, error, offline }),
    [transactions, loading, hasMore, loadMore, refresh, error, offline],
  )
}
