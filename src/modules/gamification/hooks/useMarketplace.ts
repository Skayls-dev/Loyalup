import { useEffect, useState } from 'react'
import { getCoalitions } from '../services/gamificationService'

export interface Coalition {
  id: string
  name: string
  description?: string
  logo_url?: string
  platform_fee_pct: number
}

interface UseMarketplaceReturn {
  coalitions: Coalition[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useMarketplace(): UseMarketplaceReturn {
  const [coalitions, setCoalitions] = useState<Coalition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchCoalitions = async () => {
    try {
      setLoading(true)
      const data = await getCoalitions()
      setCoalitions(data as Coalition[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch coalitions'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoalitions()
  }, [])

  return { coalitions, loading, error, refetch: fetchCoalitions }
}
