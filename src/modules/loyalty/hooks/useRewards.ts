import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { showToast } from '../../../shared/stores/toastStore'
import {
  getRewardCatalog,
  subscribeToRewards,
  useReward as consumeReward,
  type RewardCatalogItem,
} from '../services/loyaltyService'

type UseRewardsParams = {
  fournisseur_id?: string
}

type UseRewardsResult = {
  rewards: RewardCatalogItem[]
  loading: boolean
  useReward: (reward: RewardCatalogItem, pending_transaction_id?: string) => Promise<void>
  error: string | null
  refetch: () => Promise<void>
}

export function useRewards({ fournisseur_id }: UseRewardsParams): UseRewardsResult {
  const { user } = useAuth()
  const [rewards, setRewards] = useState<RewardCatalogItem[]>([])
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
      const rows = await getRewardCatalog(user.id, fournisseur_id)
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

      refetch().catch(() => null)
    })

    return () => {
      unsubscribe()
    }
  }, [fournisseur_id, refetch, user?.id])

  const useReward = useCallback(async (reward: RewardCatalogItem, pending_transaction_id?: string) => {
    if (!reward.unlocked_reward_id) {
      setError('Cette récompense n\'est pas encore débloquée.')
      return
    }

    const previous = rewards

    setRewards((prev) => prev.map((item) => (
      item.id === reward.id
        ? {
            ...item,
            status: 'locked',
            unlocked_reward_id: null,
            unlocked_at: null,
          }
        : item
    )))
    setError(null)

    try {
      await consumeReward(reward.unlocked_reward_id, pending_transaction_id)
      showToast(
        `${reward.reward_rule.emoji} ${reward.reward_rule.nom} consommée · -${reward.reward_rule.points_required} pts`,
        'success',
        3200,
      )
      await refetch()
    } catch (caughtError) {
      setRewards(previous)
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to use reward'
      setError(message)
      throw new Error(message)
    }
  }, [rewards, refetch])

  return { rewards, loading, useReward, error, refetch }
}
