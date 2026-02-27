import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import {
  getAvailableRewards,
  subscribeToRewards,
  useReward as consumeReward,
  type ClientReward,
} from '../services/loyaltyService'

type UseRewardsParams = {
  fournisseur_id?: string
}

type UseRewardsResult = {
  rewards: ClientReward[]
  loading: boolean
  useReward: (client_reward_id: string) => Promise<void>
  error: string | null
  refetch: () => Promise<void>
}

export function useRewards({ fournisseur_id }: UseRewardsParams): UseRewardsResult {
  const { user } = useAuth()
  const [rewards, setRewards] = useState<ClientReward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setRewards([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const rows = await getAvailableRewards(user.id, fournisseur_id)
      setRewards(rows)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to load rewards'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [fournisseur_id, user?.id])

  useEffect(() => {
    refetch().catch(() => null)
  }, [refetch])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    const unsubscribe = subscribeToRewards(user.id, (reward) => {
      if (fournisseur_id && reward.fournisseur_id !== fournisseur_id) {
        return
      }

      setRewards((prev) => [reward, ...prev.filter((item) => item.id !== reward.id)])
    })

    return () => {
      unsubscribe()
    }
  }, [fournisseur_id, user?.id])

  const useReward = useCallback(async (client_reward_id: string) => {
    const previous = rewards

    setRewards((prev) => prev.map((item) => (item.id === client_reward_id ? { ...item, status: 'used' } : item)))
    setError(null)

    try {
      await consumeReward(client_reward_id)
      setRewards((prev) => prev.map((item) => (item.id === client_reward_id ? { ...item, used_at: new Date().toISOString() } : item)))
    } catch (caughtError) {
      setRewards(previous)
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to use reward'
      setError(message)
      throw new Error(message)
    }
  }, [rewards])

  return { rewards, loading, useReward, error, refetch }
}
