import { useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { getClientStreak } from '../services/gamificationService'
import type { StreakData } from '../services/gamificationService'

interface UseStreakReturn {
  streak: StreakData | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useStreak(): UseStreakReturn {
  const clientId = useAuthStore((state) => state.user?.id)
  const [streak, setStreak] = useState<StreakData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStreak = async () => {
    if (!clientId) return

    try {
      setLoading(true)
      const data = await getClientStreak(clientId)
      setStreak(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch streak'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStreak()
  }, [clientId])

  return { streak, loading, error, refetch: fetchStreak }
}
