import { useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { getActiveChallenges } from '../services/gamificationService'
import type { ChallengeData } from '../services/gamificationService'

interface UseChallengstReturn {
  challenges: ChallengeData[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useChallenges(): UseChallengstReturn {
  const clientId = useAuthStore((state) => state.user?.id)
  const [challenges, setChallenges] = useState<ChallengeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchChallenges = async () => {
    if (!clientId) return

    try {
      setLoading(true)
      const data = await getActiveChallenges(clientId)
      setChallenges(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch challenges'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChallenges()
  }, [clientId])

  // Refresh every 5 seconds to update time_remaining_ms
  useEffect(() => {
    const timer = setInterval(() => {
      setChallenges((prev) =>
        prev
          .map((c) => ({
            ...c,
            time_remaining_ms: Math.max(0, new Date(c.ends_at).getTime() - Date.now()),
          }))
          .filter((c) => c.time_remaining_ms > 0),
      )
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  return { challenges, loading, error, refetch: fetchChallenges }
}
