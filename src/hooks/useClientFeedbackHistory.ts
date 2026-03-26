import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export interface ClientFeedbackHistoryItem {
  id: string
  transactionId: string
  rating: number
  comment: string | null
  createdAt: string
  merchantName: string
}

export interface UseClientFeedbackHistoryResult {
  feedback: ClientFeedbackHistoryItem[]
  loading: boolean
  error: string | null
}

type RatingRow = {
  id: string
  transaction_id: string
  rating: number | null
  comment: string | null
  created_at: string
  fournisseur_id: string | null
}

export function useClientFeedbackHistory(userId?: string, limit = 20): UseClientFeedbackHistoryResult {
  const [feedback, setFeedback] = useState<ClientFeedbackHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setFeedback([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const { data, error: ratingsError } = await supabase
          .from('merchant_ratings')
          .select('id, transaction_id, rating, comment, created_at, fournisseur_id')
          .eq('client_id', userId)
          .order('created_at', { ascending: false })
          .limit(Math.max(1, limit))

        if (ratingsError) {
          throw new Error(ratingsError.message)
        }

        const rows = (data ?? []) as RatingRow[]
        const merchantIds = [...new Set(rows.map((row) => row.fournisseur_id).filter(Boolean))] as string[]

        const { data: merchantsData, error: merchantsError } = merchantIds.length
          ? await supabase.from('fournisseurs').select('id, nom_commerce').in('id', merchantIds)
          : { data: [], error: null }

        if (merchantsError) {
          throw new Error(merchantsError.message)
        }

        const merchantMap = new Map<string, string>()
        for (const merchant of (merchantsData ?? []) as Array<{ id: string; nom_commerce?: string | null }>) {
          merchantMap.set(merchant.id, merchant.nom_commerce?.trim() || 'Marchand')
        }

        const mapped: ClientFeedbackHistoryItem[] = rows
          .map((row) => ({
            id: row.id,
            transactionId: row.transaction_id,
            rating: Number(row.rating ?? 0),
            comment: row.comment,
            createdAt: row.created_at,
            merchantName: row.fournisseur_id ? merchantMap.get(row.fournisseur_id) ?? 'Marchand' : 'Marchand',
          }))
          .filter((row) => Number.isFinite(row.rating) && row.rating >= 1 && row.rating <= 5)

        if (!cancelled) {
          setFeedback(mapped)
          setLoading(false)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setFeedback([])
          setLoading(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger vos avis')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [userId, limit])

  return useMemo(() => ({ feedback, loading, error }), [feedback, loading, error])
}
