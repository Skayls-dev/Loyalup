import { useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { getClientLevel } from '../services/gamificationService'
import type { ClientLevelData } from '../services/gamificationService'

interface UseClientLevelReturn {
  levelData: ClientLevelData | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useClientLevel(): UseClientLevelReturn {
  const clientId = useAuthStore((state) => state.user?.id)
  const [levelData, setLevelData] = useState<ClientLevelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchLevel = async () => {
    if (!clientId) return

    try {
      setLoading(true)
      const data = await getClientLevel(clientId)
      setLevelData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch level'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLevel()
  }, [clientId])

  return { levelData, loading, error, refetch: fetchLevel }
}
