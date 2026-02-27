import { useEffect } from 'react'
import { usePromotions } from '../hooks/usePromotions'
import { PromoCard } from './PromoCard'

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
          <div key={index} className="h-32 animate-pulse rounded-xl bg-zinc-800/70" />
        ))}
      </div>
    )
  }

  if (promotionsByProvider.every((group) => group.promotions.length === 0)) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-300">
        Aucune promotion en cours
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">Promotions</h2>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
          {totalCount} promos actives
        </span>
      </div>

      {error ? <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">{error}</p> : null}

      {promotionsByProvider
        .filter((group) => group.promotions.length > 0)
        .map((group) => {
          const hasNew = newPromotionProviderIds.includes(group.fournisseur_id)

          return (
            <section key={group.fournisseur_id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-200">{group.fournisseur_nom}</h3>
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
