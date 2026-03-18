import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export interface UserNetworkItem {
  id: string
  name: string
  emoji: string
  bgColor: string
  badgeColor: string
  points: number
  merchantCount: number
  multiplier: number
  nextThreshold: number
}

export interface UseUserNetworksResult {
  networks: UserNetworkItem[]
  loading: boolean
  error: string | null
}

const FALLBACK_EMOJI = '🌐'

export function useUserNetworks(userId?: string): UseUserNetworksResult {
  const [networks, setNetworks] = useState<UserNetworkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setNetworks([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const { data, error: queryError } = await supabase
          .from('user_networks')
          .select(
            `
            network_id,
            points,
            networks:network_id (
              id,
              name,
              emoji,
              merchant_count,
              network_config (
                bg_color,
                badge_color,
                multiplier,
                next_threshold
              )
            )
          `,
          )
          .eq('user_id', userId)

        if (queryError) {
          throw new Error(queryError.message)
        }

        const mapped: UserNetworkItem[] = (data ?? [])
          .map((row) => {
            const networkRaw = row.networks as unknown
            const network = Array.isArray(networkRaw) ? networkRaw[0] : networkRaw
            if (!network || typeof network !== 'object') {
              return null
            }

            const cfgRaw = (network as { network_config?: unknown }).network_config
            const config = Array.isArray(cfgRaw) ? cfgRaw[0] : cfgRaw

            const id = String((network as { id?: string }).id ?? (row as { network_id?: string }).network_id ?? '')
            const name = String((network as { name?: string }).name ?? 'Réseau')
            const emoji = String((network as { emoji?: string }).emoji ?? FALLBACK_EMOJI)
            const merchantCount = Number((network as { merchant_count?: number }).merchant_count ?? 0)

            const bgColor =
              typeof (config as { bg_color?: unknown })?.bg_color === 'string'
                ? String((config as { bg_color: string }).bg_color)
                : '#EBE9FF'
            const badgeColor =
              typeof (config as { badge_color?: unknown })?.badge_color === 'string'
                ? String((config as { badge_color: string }).badge_color)
                : '#5B4FE8'
            const multiplier = Number((config as { multiplier?: number })?.multiplier ?? 1)
            const nextThreshold = Number((config as { next_threshold?: number })?.next_threshold ?? 1000)

            return {
              id,
              name,
              emoji,
              bgColor,
              badgeColor,
              points: Number((row as { points?: number }).points ?? 0),
              merchantCount,
              multiplier,
              nextThreshold,
            } satisfies UserNetworkItem
          })
          .filter((item): item is UserNetworkItem => item !== null)

        if (!cancelled) {
          setNetworks(mapped)
          setLoading(false)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setNetworks([])
          setLoading(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger les réseaux')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [userId])

  return useMemo(
    () => ({ networks, loading, error }),
    [networks, loading, error],
  )
}
