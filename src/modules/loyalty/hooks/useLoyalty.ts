import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/hooks/useAuth'
import {
  getClientCards,
  getClientPartnerBalance,
  getRewardRules,
  subscribeToPoints,
  type LoyaltyCardBase,
  type RewardRule,
} from '../services/loyaltyService'
import { QUERY_STALE } from '../../../shared/lib/queryClient'

export type LoyaltyCard = LoyaltyCardBase & {
  displaySolde: number
  nextReward: RewardRule | null
  progressPercent: number
  pointsNeeded: number
}

type UseLoyaltyResult = {
  cards: LoyaltyCard[]
  loading: boolean
  error: string | null
  partnerWarning: string | null
  loyaltyPoints: number
  partnerPoints: number
  totalPoints: number
  refetch: () => Promise<void>
  offline: boolean
}

const cacheKeyFor = (clientId: string) => `loyalty:cards:${clientId}`

export function useLoyalty(): UseLoyaltyResult {
  const { user } = useAuth()
  const [liveCards, setLiveCards] = useState<LoyaltyCard[] | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)

  const hydrateCards = useCallback(async (clientId: string) => {
    const baseCards = await getClientCards(clientId)

    const cardsWithRewards = await Promise.all(
      baseCards.map(async (card) => {
        const rewardRules = await getRewardRules(card.fournisseur.id)
        const nextReward = rewardRules.find((rule) => rule.points_required > card.solde) ?? null

        const progressPercent = nextReward
          ? Math.min(100, Math.round((card.solde / nextReward.points_required) * 100))
          : 100

        const pointsNeeded = nextReward ? Math.max(0, nextReward.points_required - card.solde) : 0

        return {
          ...card,
          displaySolde: card.solde,
          nextReward,
          progressPercent,
          pointsNeeded,
        } satisfies LoyaltyCard
      }),
    )

    return cardsWithRewards
  }, [])

  const query = useQuery({
    queryKey: ['loyalty-cards', user?.id],
    enabled: Boolean(user?.id),
    staleTime: QUERY_STALE.fiveMinutes,
    queryFn: async () => {
      if (!user?.id) {
        return {
          cards: [] as LoyaltyCard[],
          partnerPoints: 0,
          partnerWarning: null,
        }
      }

      try {
        const nextCards = await hydrateCards(user.id)
        let partnerPoints = 0
        let partnerWarning: string | null = null

        try {
          const partnerWallet = await getClientPartnerBalance(user.id)
          partnerPoints = Number(partnerWallet.partner_balance ?? 0)
          const providerBalanceMap = new Map(
            (partnerWallet.partner_balances_by_provider ?? []).map((row) => [row.fournisseur_id, Number(row.balance ?? 0)]),
          )

          for (const card of nextCards) {
            const providerPartnerBalance = providerBalanceMap.get(card.fournisseur.id)
            if (providerPartnerBalance === undefined) {
              continue
            }

            card.displaySolde = providerPartnerBalance
            card.nextReward = (await getRewardRules(card.fournisseur.id)).find(
              (rule) => rule.points_required > card.displaySolde,
            ) ?? null
            card.progressPercent = card.nextReward
              ? Math.min(100, Math.round((card.displaySolde / card.nextReward.points_required) * 100))
              : 100
            card.pointsNeeded = card.nextReward
              ? Math.max(0, card.nextReward.points_required - card.displaySolde)
              : 0
          }
        } catch (error) {
          partnerPoints = 0
          partnerWarning = error instanceof Error
            ? `Solde partner indisponible: ${error.message}`
            : 'Solde partner indisponible'
        }

        localStorage.setItem(
          cacheKeyFor(user.id),
          JSON.stringify({ cards: nextCards, partnerPoints }),
        )
        setOffline(false)
        return {
          cards: nextCards,
          partnerPoints,
          partnerWarning,
        }
      } catch {
        const cached = localStorage.getItem(cacheKeyFor(user.id))
        if (cached) {
          setOffline(true)
          const parsed = JSON.parse(cached) as { cards?: LoyaltyCard[]; partnerPoints?: number } | LoyaltyCard[]

          if (Array.isArray(parsed)) {
            return {
              cards: parsed,
              partnerPoints: 0,
              partnerWarning: null,
            }
          }

          return {
            cards: parsed.cards ?? [],
            partnerPoints: Number(parsed.partnerPoints ?? 0),
            partnerWarning: null,
          }
        }

        throw new Error('Unable to load loyalty cards')
      }
    },
  })

  const cards = liveCards ?? (query.data?.cards ?? [])
  const partnerPoints = Number(query.data?.partnerPoints ?? 0)
  const partnerWarning = query.data?.partnerWarning ?? null

  const refetch = useCallback(async () => {
    const { data } = await query.refetch()
    setLiveCards(data?.cards ?? [])
  }, [query])

  useEffect(() => {
    if (!user?.id || cards.length === 0) {
      return
    }

    const unsubscribers = cards.map((card) =>
      subscribeToPoints(user.id, card.fournisseur.id, (nextSolde) => {
        setLiveCards((prevCards) => {
          const baseCards = prevCards ?? cards
          return baseCards.map((item) => {
            if (item.fournisseur.id !== card.fournisseur.id) {
              return item
            }

            const progressPercent = item.nextReward
              ? Math.min(100, Math.round((nextSolde / item.nextReward.points_required) * 100))
              : 100
            const pointsNeeded = item.nextReward
              ? Math.max(0, item.nextReward.points_required - nextSolde)
              : 0

            return {
              ...item,
              solde: nextSolde,
              progressPercent,
              pointsNeeded,
            }
          })
        })
      }),
    )

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [cards, user?.id])

  useEffect(() => {
    const onStatus = () => setOffline(!navigator.onLine)
    window.addEventListener('online', onStatus)
    window.addEventListener('offline', onStatus)
    return () => {
      window.removeEventListener('online', onStatus)
      window.removeEventListener('offline', onStatus)
    }
  }, [])

  const loyaltyPoints = useMemo(() => cards.reduce((sum, card) => sum + card.solde, 0), [cards])
  const totalPoints = loyaltyPoints + partnerPoints

  return {
    cards,
    loading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    partnerWarning,
    loyaltyPoints,
    partnerPoints,
    totalPoints,
    refetch,
    offline,
  }
}
