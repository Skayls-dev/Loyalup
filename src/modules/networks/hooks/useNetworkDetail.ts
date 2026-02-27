import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getNetworkBySlug } from '../services/networkService'
import { useAuth } from '../../auth/hooks/useAuth'

export function useNetworkDetail(slug: string) {
  const { role, user } = useAuth()

  const query = useQuery({
    queryKey: ['network', 'detail', slug],
    queryFn: () => getNetworkBySlug(slug),
    enabled: Boolean(slug),
  })

  const network = query.data?.network ?? null
  const members = query.data?.members ?? []
  const announcements = query.data?.announcements ?? []

  const isMember = useMemo(() => {
    if (!network || !user?.id) {
      return false
    }

    if (role === 'fournisseur') {
      return members.length > 0
    }

    return false
  }, [members.length, network, role, user?.id])

  const canJoin = useMemo(() => {
    if (!network) {
      return false
    }

    return network.is_active && !network.is_draft && network.is_public
  }, [network])

  return {
    network,
    members,
    announcements,
    isMember,
    canJoin,
    loading: query.isLoading,
    refresh: () => query.refetch(),
    error: (query.error as Error | null) ?? null,
  }
}
