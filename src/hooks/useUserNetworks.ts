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

function resolveNetworkName(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw
  }

  if (raw && typeof raw === 'object') {
    const localized = raw as Record<string, unknown>
    if (typeof localized.fr === 'string' && localized.fr.trim().length > 0) {
      return localized.fr
    }
    if (typeof localized.en === 'string' && localized.en.trim().length > 0) {
      return localized.en
    }

    for (const value of Object.values(localized)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value
      }
    }
  }

  return 'Reseau'
}

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
          .from('network_clients')
          .select(
            `
            network_id,
            total_network_points,
            networks:network_id (
              id,
              name,
              emoji,
              member_count,
              primary_color,
              secondary_color,
              points_multiplier
            )
          `,
          )
          .eq('client_id', userId)

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

            const id = String((network as { id?: string }).id ?? (row as { network_id?: string }).network_id ?? '')
            const name = resolveNetworkName((network as { name?: unknown }).name)
            const emoji = String((network as { emoji?: string }).emoji ?? FALLBACK_EMOJI)
            const merchantCount = Number((network as { member_count?: number }).member_count ?? 0)

            const primaryColor = typeof (network as { primary_color?: unknown }).primary_color === 'string'
              ? String((network as { primary_color: string }).primary_color) : '#5B4FE8'
            const bgColor = '#EBE9FF'
            const badgeColor = typeof (network as { secondary_color?: unknown }).secondary_color === 'string'
              ? String((network as { secondary_color: string }).secondary_color) : primaryColor
            const multiplier = Number((network as { points_multiplier?: number }).points_multiplier ?? 1)
            const nextThreshold = 1000

            return {
              id,
              name,
              emoji,
              bgColor,
              badgeColor,
              points: Number((row as { total_network_points?: number }).total_network_points ?? 0),
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
