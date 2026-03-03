import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnnouncementsForNetwork, subscribeToNetworkUpdates } from '../services/networkService'

export function useNetworkAnnouncements(network_id?: string) {
  const [unreadCount, setUnreadCount] = useState(0)

  const query = useQuery({
    queryKey: ['network-announcements', network_id ?? 'all'],
    queryFn: () => getAnnouncementsForNetwork(network_id),
    enabled: Boolean(network_id),
  })

  useEffect(() => {
    if (!network_id) {
      return
    }

    const unsubscribe = subscribeToNetworkUpdates(network_id, (event) => {
      if (event.type === 'announcement_created') {
        setUnreadCount((value) => value + 1)
        void query.refetch()
      }
    })

    return () => {
      unsubscribe()
    }
  }, [network_id, query])

  const announcements = useMemo(() => query.data ?? [], [query.data])

  return {
    announcements,
    unreadCount,
    loading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    refresh: () => query.refetch(),
    markAllRead: () => setUnreadCount(0),
  }
}
