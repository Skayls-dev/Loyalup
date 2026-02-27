import { useQuery } from '@tanstack/react-query'
import { getNetworkGrowthTimeline, getNetworkStats } from '../services/networkService'

export function useNetworkStats(network_id: string) {
  const statsQuery = useQuery({
    queryKey: ['network-stats', network_id],
    queryFn: () => getNetworkStats(network_id),
    enabled: Boolean(network_id),
    retry: false,
    refetchInterval: 60_000,
  })

  const timelineQuery = useQuery({
    queryKey: ['network-growth', network_id],
    queryFn: () => getNetworkGrowthTimeline(network_id, '90d'),
    enabled: Boolean(network_id),
    refetchInterval: 60_000,
  })

  return {
    stats: statsQuery.data ?? null,
    timeline: timelineQuery.data ?? null,
    loading: statsQuery.isLoading || timelineQuery.isLoading,
    refresh: () => {
      void statsQuery.refetch()
      void timelineQuery.refetch()
    },
    error: (statsQuery.error as Error | null) ?? (timelineQuery.error as Error | null) ?? null,
  }
}
