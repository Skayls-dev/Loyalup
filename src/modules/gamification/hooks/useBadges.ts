import { useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { getClientBadges } from '../services/gamificationService'
import type { BadgeData } from '../services/gamificationService'

interface UseBadgesReturn {
  earned: BadgeData[]
  locked: BadgeData[]
  total: number
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useBadges(): UseBadgesReturn {
  const clientId = useAuthStore((state) => state.user?.id)
  const [earned, setEarned] = useState<BadgeData[]>([])
  const [locked, setLocked] = useState<BadgeData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchBadges = async () => {
    if (!clientId) return

    try {
      setLoading(true)
      const data = await getClientBadges(clientId)
      setEarned(data.earned)
      setLocked(data.locked)
      setTotal(data.total)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch badges'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBadges()
  }, [clientId])

  return { earned, locked, total, loading, error, refetch: fetchBadges }
}
