import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/hooks/useAuth'
import { supabase } from '../../../shared/lib/supabaseClient'
import { QUERY_STALE } from '../../../shared/lib/queryClient'
import { getProviderStats, type ProviderStats } from '../services/providerService'

type UseProviderStatsResult = {
  stats: ProviderStats | null
  loading: boolean
  lastUpdated: string | null
  refresh: () => Promise<void>
  fournisseurId: string | null
}

export function useProviderStats(): UseProviderStatsResult {
  const { user } = useAuth()

  const resolveProviderId = useCallback(async (): Promise<string | null> => {
    if (!user?.id) {
      return null
    }

    const { data, error } = await supabase
      .from('fournisseurs')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    return (data?.id as string | undefined) ?? null
  }, [user?.id])

  const query = useQuery({
    queryKey: ['provider-stats', user?.id],
    enabled: Boolean(user?.id),
    staleTime: QUERY_STALE.fiveMinutes,
    refetchInterval: 30_000,
    queryFn: async () => {
      const providerId = await resolveProviderId()
      if (!providerId) {
        return {
          fournisseurId: null,
          stats: null,
        }
      }

      const result = await getProviderStats(providerId)
      return {
        fournisseurId: providerId,
        stats: result,
      }
    },
  })

  const refresh = useCallback(async () => {
    await query.refetch()
  }, [query])

  return {
    stats: (query.data?.stats as ProviderStats | null) ?? null,
    loading: query.isLoading || query.isFetching,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toISOString() : null,
    refresh,
    fournisseurId: query.data?.fournisseurId ?? null,
  }
}
