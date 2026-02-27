import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../shared/lib/supabaseClient'

type BonusItem = {
  network: string
  bonus_points: number
}

async function getTodayNetworkBonus() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return [] as BonusItem[]
  }

  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('network_point_events')
    .select('bonus_points, networks(name)')
    .eq('client_id', user.id)
    .gte('created_at', start.toISOString())

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as Array<{ bonus_points: number; networks: { name: Record<string, string> } | Array<{ name: Record<string, string> }> | null }>).map((row) => {
    const network = Array.isArray(row.networks) ? row.networks[0] : row.networks
    return {
      network: network?.name?.fr ?? network?.name?.en ?? 'Réseau',
      bonus_points: Number(row.bonus_points ?? 0),
    }
  })
}

export function useNetworkBonus() {
  const query = useQuery({
    queryKey: ['network-bonus-today'],
    queryFn: getTodayNetworkBonus,
  })

  const bonusByNetwork = useMemo(() => query.data ?? [], [query.data])
  const totalBonusToday = useMemo(
    () => bonusByNetwork.reduce((sum, row) => sum + row.bonus_points, 0),
    [bonusByNetwork],
  )

  return {
    bonusByNetwork,
    totalBonusToday,
    loading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  }
}
