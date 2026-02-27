import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProviderNetworks, leaveNetwork, requestJoinNetwork } from '../services/networkService'

export function useProviderNetworks() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['provider-networks'],
    queryFn: () => getProviderNetworks(),
  })

  const requestJoin = useMutation({
    mutationFn: ({ networkId, message }: { networkId: string; message?: string }) => requestJoinNetwork(networkId, message),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-networks'] })
    },
  })

  const leave = useMutation({
    mutationFn: (networkId: string) => leaveNetwork(networkId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-networks'] })
    },
  })

  const active = useMemo(() => (query.data ?? []).filter((row) => row.status === 'active'), [query.data])
  const pending = useMemo(() => (query.data ?? []).filter((row) => row.status === 'pending'), [query.data])

  return {
    active,
    pending,
    requestJoin: requestJoin.mutateAsync,
    leave: leave.mutateAsync,
    refresh: () => query.refetch(),
    loading: query.isLoading,
    error: (query.error as Error | null) ?? (requestJoin.error as Error | null) ?? (leave.error as Error | null) ?? null,
  }
}
