import { useEffect, useState } from 'react'
import { getReferrerTier } from '../services/gamificationService'
import type { ReferrerTierInfo } from '../services/gamificationService'

export function useReferrerTier() {
  const [tier, setTier] = useState<ReferrerTierInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    loadTier()
  }, [])

  const loadTier = async () => {
    try {
      setLoading(true)
      setError(null)
      const tierData = await getReferrerTier()
      setTier(tierData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load tier'))
    } finally {
      setLoading(false)
    }
  }

  return { tier, loading, error }
}
