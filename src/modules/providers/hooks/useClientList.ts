import { useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/hooks/useAuth'
import { supabase } from '../../../shared/lib/supabaseClient'
import { getClientList, type ProviderClient } from '../services/providerService'

type SortBy = 'points' | 'visits' | 'last_visit'

type UseClientListResult = {
  clients: ProviderClient[]
  loading: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  searchQuery: string
  setSearchQuery: (query: string) => void
  sortBy: SortBy
  setSortBy: (value: SortBy) => void
  fournisseurId: string | null
}

const PAGE_SIZE = 20

export function useClientList(): UseClientListResult {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('points')

  const resolveProviderId = useCallback(async () => {
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

  const providerQuery = useQuery({
    queryKey: ['provider-id', user?.id],
    enabled: Boolean(user?.id),
    queryFn: resolveProviderId,
  })

  const fournisseurId = providerQuery.data ?? null

  const clientsQuery = useInfiniteQuery({
    queryKey: ['provider-clients', fournisseurId],
    enabled: Boolean(fournisseurId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => getClientList(fournisseurId as string, pageParam, PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) {
        return undefined
      }

      return allPages.length
    },
  })

  const rawClients = useMemo(() => {
    const pages = clientsQuery.data?.pages ?? []
    const merged = pages.flatMap((page) => page)
    const seen = new Set<string>()

    return merged.filter((client) => {
      if (seen.has(client.profile.id)) {
        return false
      }
      seen.add(client.profile.id)
      return true
    })
  }, [clientsQuery.data?.pages])

  const loadMore = useCallback(async () => {
    if (!clientsQuery.hasNextPage || clientsQuery.isFetchingNextPage) {
      return
    }

    await clientsQuery.fetchNextPage()
  }, [clientsQuery])

  const clients = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const filtered = normalizedQuery
      ? rawClients.filter((item) =>
          `${item.profile.nom} ${item.profile.email}`.toLowerCase().includes(normalizedQuery),
        )
      : rawClients

    const sorted = [...filtered]

    sorted.sort((left, right) => {
      if (sortBy === 'visits') {
        return right.total_visites - left.total_visites
      }

      if (sortBy === 'last_visit') {
        const leftTime = left.last_visit ? new Date(left.last_visit).getTime() : 0
        const rightTime = right.last_visit ? new Date(right.last_visit).getTime() : 0
        return rightTime - leftTime
      }

      return right.solde - left.solde
    })

    return sorted
  }, [rawClients, searchQuery, sortBy])

  return {
    clients,
    loading: providerQuery.isLoading || clientsQuery.isLoading || clientsQuery.isFetching,
    hasMore: Boolean(clientsQuery.hasNextPage),
    loadMore,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    fournisseurId,
  }
}
