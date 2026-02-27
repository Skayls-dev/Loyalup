import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/hooks/useAuth'
import { QUERY_STALE } from '../../../shared/lib/queryClient'
import {
  getAllClientPromotions,
  type Promotion,
  type PromotionGroup,
} from '../services/promotionService'
import { usePromoRealtime } from './usePromoRealtime'

type UsePromotionsResult = {
  promotionsByProvider: PromotionGroup[]
  loading: boolean
  error: string | null
  totalCount: number
  newPromotionsCount: number
  newPromotionProviderIds: string[]
  clearNewPromotionsCount: () => void
}

export function usePromotions(): UsePromotionsResult {
  const { user } = useAuth()
  const [livePromotionsByProvider, setLivePromotionsByProvider] = useState<PromotionGroup[] | null>(null)
  const [newProviderIds, setNewProviderIds] = useState<string[]>([])

  const query = useQuery({
    queryKey: ['client-promotions', user?.id],
    enabled: Boolean(user?.id),
    staleTime: QUERY_STALE.fiveMinutes,
    queryFn: async () => {
      if (!user?.id) {
        return [] as PromotionGroup[]
      }

      return getAllClientPromotions(user.id)
    },
  })

  const promotionsByProvider = livePromotionsByProvider ?? (query.data ?? [])
  const promotionsByProviderRef = useRef<PromotionGroup[]>(promotionsByProvider)

  useEffect(() => {
    promotionsByProviderRef.current = promotionsByProvider
  }, [promotionsByProvider])

  const upsertPromotion = useCallback((current: PromotionGroup[], promotion: Promotion): PromotionGroup[] => {
    const existingGroup = current.find((group) => group.fournisseur_id === promotion.fournisseur_id)

    if (!existingGroup) {
      return [
        ...current,
        {
          fournisseur_id: promotion.fournisseur_id,
          fournisseur_nom: 'Commerce',
          promotions: [promotion],
        },
      ]
    }

    return current.map((group) => {
      if (group.fournisseur_id !== promotion.fournisseur_id) {
        return group
      }

      const exists = group.promotions.some((item) => item.id === promotion.id)
      if (exists) {
        return group
      }

      return {
        ...group,
        promotions: [promotion, ...group.promotions],
      }
    })
  }, [])

  const providerIds = useMemo(
    () => promotionsByProvider.map((group) => group.fournisseur_id),
    [promotionsByProvider],
  )

  const handleNewPromotion = useCallback((promotion: Promotion) => {
    setNewProviderIds((prev) => (prev.includes(promotion.fournisseur_id) ? prev : [...prev, promotion.fournisseur_id]))

    const currentGroups = promotionsByProviderRef.current
    const provider = currentGroups.find((item) => item.fournisseur_id === promotion.fournisseur_id)
    const providerName = provider?.fournisseur_nom ?? 'votre commerce'

    setLivePromotionsByProvider((prev) => upsertPromotion(prev ?? currentGroups, promotion))

    window.dispatchEvent(
      new CustomEvent('promo:toast', {
        detail: {
          message: `🔥 Nouvelle promo chez ${providerName}!`,
          fournisseurId: promotion.fournisseur_id,
        },
      }),
    )
  }, [upsertPromotion])

  const { newPromotionsCount, clearNewPromotionsCount } = usePromoRealtime({
    fournisseurIds: providerIds,
    onNewPromotion: handleNewPromotion,
  })

  const clearAllNewPromotions = useCallback(() => {
    setNewProviderIds([])
    clearNewPromotionsCount()
  }, [clearNewPromotionsCount])

  const totalCount = useMemo(
    () => promotionsByProvider.reduce((sum, group) => sum + group.promotions.length, 0),
    [promotionsByProvider],
  )

  return {
    promotionsByProvider,
    loading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    totalCount,
    newPromotionsCount,
    newPromotionProviderIds: newProviderIds,
    clearNewPromotionsCount: clearAllNewPromotions,
  }
}
