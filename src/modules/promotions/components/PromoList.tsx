import { useEffect } from 'react'
import { usePromotions } from '../hooks/usePromotions'
import { PromoCard } from './PromoCard'
import { EmptyState, Skeleton } from '../../../shared/components/client-ui'

export function PromoList() {
  const {
    promotionsByProvider,
    loading,
    error,
    totalCount,
    newPromotionProviderIds,
    clearNewPromotionsCount,
  } = usePromotions()

  useEffect(() => {
    return () => {
      clearNewPromotionsCount()
    }
  }, [clearNewPromotionsCount])

  if (loading && promotionsByProvider.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
    )
  }

  if (promotionsByProvider.every((group) => group.promotions.length === 0)) {
    return (
      <EmptyState title="Aucune promotion en cours" description="Revenez bientôt pour profiter des offres limitées." />
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Promotions</h2>
        <span className="rounded-full border border-slate-200 bg-white/85 px-2 py-1 text-xs text-slate-600">
          {totalCount} promos actives
        </span>
      </div>

      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}

      {promotionsByProvider
        .filter((group) => group.promotions.length > 0)
        .map((group) => {
          const hasNew = newPromotionProviderIds.includes(group.fournisseur_id)

          return (
            <section key={group.fournisseur_id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">{group.fournisseur_nom}</h3>
                {hasNew ? <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Nouvelle promo" /> : null}
              </div>

              <div className="flex gap-3 overflow-x-auto pb-1">
                {group.promotions.map((promotion) => (
                  <PromoCard
                    key={promotion.id}
                    promotion={promotion}
                    fournisseurNom={group.fournisseur_nom}
                    isNew={hasNew}
                  />
                ))}
              </div>
            </section>
          )
        })}
    </section>
  )
}
