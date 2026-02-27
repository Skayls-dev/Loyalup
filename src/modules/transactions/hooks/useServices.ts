import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchServices, type Service } from '../services/transactionService'

type UseServicesResult = {
  services: Service[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useServices(fournisseurId: string | null): UseServicesResult {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!fournisseurId) {
      setServices([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchServices(fournisseurId)
      setServices(data)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to load services'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [fournisseurId])

  useEffect(() => {
    refetch().catch(() => null)
  }, [refetch])

  return useMemo(
    () => ({ services, loading, error, refetch }),
    [services, loading, error, refetch],
  )
}
