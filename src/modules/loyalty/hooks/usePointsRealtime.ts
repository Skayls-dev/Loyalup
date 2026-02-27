import { useEffect, useRef, useState } from 'react'
import {
  getClientPointsBalance,
  subscribeToPoints,
  subscribeToRewards,
  type ClientReward,
} from '../services/loyaltyService'

type UsePointsRealtimeParams = {
  client_id: string
  fournisseur_id: string
}

type UsePointsRealtimeResult = {
  solde: number
  lastUpdate: string | null
  newRewardUnlocked: ClientReward | null
}

export function usePointsRealtime({
  client_id,
  fournisseur_id,
}: UsePointsRealtimeParams): UsePointsRealtimeResult {
  const [solde, setSolde] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [newRewardUnlocked, setNewRewardUnlocked] = useState<ClientReward | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    if (!client_id || !fournisseur_id) {
      setSolde(0)
      setLastUpdate(null)
      setNewRewardUnlocked(null)
      return
    }

    mountedRef.current = true

    const loadBalance = async () => {
      try {
        const nextBalance = await getClientPointsBalance(client_id, fournisseur_id)
        if (!mountedRef.current) {
          return
        }

        setSolde(nextBalance)
        setLastUpdate(new Date().toISOString())
      } catch {
        if (!mountedRef.current) {
          return
        }
      }
    }

    loadBalance().catch(() => null)

    const unsubscribePoints = subscribeToPoints(client_id, fournisseur_id, (nextSolde) => {
      if (!mountedRef.current) {
        return
      }

      setSolde(nextSolde)
      setLastUpdate(new Date().toISOString())
    })

    const unsubscribeRewards = subscribeToRewards(client_id, (reward) => {
      if (!mountedRef.current || reward.fournisseur_id !== fournisseur_id) {
        return
      }

      setNewRewardUnlocked(reward)
      window.dispatchEvent(
        new CustomEvent('loyalty:toast', {
          detail: {
            message: `🎁 Récompense débloquée chez ${reward.reward_rule.nom}!`,
            fournisseurId: reward.fournisseur_id,
          },
        }),
      )
    })

    return () => {
      mountedRef.current = false
      unsubscribePoints()
      unsubscribeRewards()
    }
  }, [client_id, fournisseur_id])

  return { solde, lastUpdate, newRewardUnlocked }
}
