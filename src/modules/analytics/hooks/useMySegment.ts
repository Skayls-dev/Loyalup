import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMySegment } from '../services/analyticsService'
import { useAuth } from '../../auth/hooks/useAuth'

export function useMySegment() {
  const { user } = useAuth()

  const query = useQuery({
    queryKey: ['my-segment'],
    queryFn: getMySegment,
    enabled: Boolean(user?.id),
    retry: false,
  })

  const segment = query.data?.segment_type ?? null

  return useMemo(
    () => ({
      segment,
      data: query.data?.segment_data ?? null,
      score: query.data?.score ?? null,
      isChampion: segment === 'champion',
      isAtRisk: segment === 'at_risk',
      isNew: segment === 'new',
      loading: query.isLoading,
    }),
    [query.data?.score, query.data?.segment_data, query.isLoading, segment],
  )
}
