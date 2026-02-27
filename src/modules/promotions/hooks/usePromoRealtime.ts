import { useCallback, useEffect, useState } from 'react'
import { subscribeToPromotions, type Promotion } from '../services/promotionService'

type UsePromoRealtimeParams = {
  fournisseurIds: string[]
  onNewPromotion: (promotion: Promotion) => void
}

export function usePromoRealtime({ fournisseurIds, onNewPromotion }: UsePromoRealtimeParams) {
  const [newPromotionsCount, setNewPromotionsCount] = useState(0)

  useEffect(() => {
    if (fournisseurIds.length === 0) {
      return
    }

    const unsubscribers = fournisseurIds.map((fournisseurId) =>
      subscribeToPromotions(fournisseurId, (promotion) => {
        onNewPromotion(promotion)
        setNewPromotionsCount((prev) => prev + 1)
      }),
    )

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [fournisseurIds, onNewPromotion])

  const clearNewPromotionsCount = useCallback(() => {
    setNewPromotionsCount(0)
  }, [])

  return {
    newPromotionsCount,
    clearNewPromotionsCount,
  }
}
