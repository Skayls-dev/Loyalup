import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enrollInNetwork, getAllNetworks, getClientNetworks, getEligibleNetworks, unenrollFromNetwork } from '../services/networkService'
import type { NetworkFilters } from '../types/networkTypes'
import { useAuth } from '../../auth/hooks/useAuth'

export function useNetworks() {
  const [filters, setFilters] = useState<NetworkFilters>({})
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const allQuery = useQuery({
    queryKey: ['networks', 'all', filters],
    queryFn: () => getAllNetworks(filters),
  })

  const enrolledQuery = useQuery({
    queryKey: ['networks', 'enrolled'],
    queryFn: () => getClientNetworks(),
    enabled: Boolean(user?.id),
  })

  const eligibleQuery = useQuery({
    queryKey: ['networks', 'eligible'],
    queryFn: getEligibleNetworks,
    enabled: Boolean(user?.id),
  })

  const enrollMutation = useMutation({
    mutationFn: ({ networkId, inviteCode }: { networkId: string; inviteCode?: string }) =>
      enrollInNetwork(networkId, inviteCode),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['networks', 'all'] }),
        queryClient.invalidateQueries({ queryKey: ['networks', 'enrolled'] }),
        queryClient.invalidateQueries({ queryKey: ['networks', 'eligible'] }),
      ])
    },
  })

  const unenrollMutation = useMutation({
    mutationFn: (networkId: string) => unenrollFromNetwork(networkId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['networks', 'all'] }),
        queryClient.invalidateQueries({ queryKey: ['networks', 'enrolled'] }),
        queryClient.invalidateQueries({ queryKey: ['networks', 'eligible'] }),
      ])
    },
  })

  return useMemo(
    () => ({
      all: allQuery.data ?? [],
      enrolled: enrolledQuery.data ?? [],
      eligible: eligibleQuery.data ?? [],
      loading: allQuery.isLoading || enrolledQuery.isLoading || eligibleQuery.isLoading,
      refresh: async () => {
        await Promise.all([allQuery.refetch(), enrolledQuery.refetch(), eligibleQuery.refetch()])
      },
      filters,
      setFilters,
      enroll: enrollMutation.mutateAsync,
      unenroll: unenrollMutation.mutateAsync,
      error:
        (allQuery.error as Error | null) ??
        (enrolledQuery.error as Error | null) ??
        (eligibleQuery.error as Error | null) ??
        (enrollMutation.error as Error | null) ??
        (unenrollMutation.error as Error | null) ??
        null,
    }),
    [
      allQuery.data,
      allQuery.error,
      allQuery.isLoading,
      allQuery.refetch,
      eligibleQuery.data,
      eligibleQuery.error,
      eligibleQuery.isLoading,
      eligibleQuery.refetch,
      enrolledQuery.data,
      enrolledQuery.error,
      enrolledQuery.isLoading,
      enrolledQuery.refetch,
      enrollMutation.error,
      enrollMutation.mutateAsync,
      filters,
      unenrollMutation.error,
      unenrollMutation.mutateAsync,
    ],
  )
}
