import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export interface MerchantFeedbackItem {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  clientId: string | null
  clientName: string | null
}

export interface UseMerchantFeedbackResult {
  feedback: MerchantFeedbackItem[]
  loading: boolean
  error: string | null
}

type MerchantRatingRow = {
  id: string
  rating: number | null
  comment: string | null
  created_at: string
  client_id: string | null
}

type ProfileNameRow = {
  id: string
  nom: string | null
}

function buildClientDisplayName(profile?: ProfileNameRow): string | null {
  if (!profile) {
    return null
  }

  const nom = profile.nom?.trim() ?? ''
  return nom.length > 0 ? nom : null
}

export function useMerchantFeedback(merchantId: string, limit = 8): UseMerchantFeedbackResult {
  const [feedback, setFeedback] = useState<MerchantFeedbackItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!merchantId) {
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
        const { data, error: fetchError } = await supabase
          .from('merchant_ratings')
          .select('id, rating, comment, created_at, client_id')
          .eq('fournisseur_id', merchantId)
          .order('created_at', { ascending: false })
          .limit(Math.max(1, limit))

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        const rows = (data ?? []) as MerchantRatingRow[]
        const clientIds = Array.from(new Set(rows.map((row) => row.client_id).filter((id): id is string => Boolean(id))))

        const nameByClientId = new Map<string, string>()
        if (clientIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nom')
            .in('id', clientIds)

          if (profilesError) {
            throw new Error(profilesError.message)
          }

          const profileRows = (profilesData ?? []) as ProfileNameRow[]
          profileRows.forEach((profile) => {
            const name = buildClientDisplayName(profile)
            if (name) {
              nameByClientId.set(profile.id, name)
            }
          })
        }

        const mapped: MerchantFeedbackItem[] = rows
          .map((row) => ({
            id: row.id,
            rating: Number(row.rating ?? 0),
            comment: row.comment,
            createdAt: row.created_at,
            clientId: row.client_id,
            clientName: row.client_id ? nameByClientId.get(row.client_id) ?? null : null,
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
          setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger les avis clients')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [merchantId, limit])

  return useMemo(() => ({ feedback, loading, error }), [feedback, loading, error])
}
