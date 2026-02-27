import { useQuery } from '@tanstack/react-query'
import { getNetworkLeaderboard } from '../services/networkService'

export function useNetworkLeaderboard(network_id: string, limit = 50) {
  const query = useQuery({
    queryKey: ['network-leaderboard', network_id, limit],
    queryFn: () => getNetworkLeaderboard(network_id, limit),
    enabled: Boolean(network_id),
    refetchInterval: 60_000,
  })

  return {
    entries: query.data?.entries ?? [],
    myRank: query.data?.myRank ?? null,
    myScore: query.data?.myScore ?? null,
    loading: query.isLoading,
    refresh: () => query.refetch(),
    error: (query.error as Error | null) ?? null,
  }
}
