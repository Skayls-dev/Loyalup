import { useRef } from 'react'
import type { TouchEventHandler } from 'react'
import { useLoyalty } from '../hooks/useLoyalty'
import { LoyaltyCard } from './LoyaltyCard'
import { EmptyState, PrimaryButton, Skeleton, StatCard } from '../../../shared/components/client-ui'

export function LoyaltyCardList() {
  const { cards, loading, error, totalPoints, loyaltyPoints, partnerPoints, refetch, offline } = useLoyalty()
  const touchStartY = useRef<number | null>(null)

  const onTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    if (window.scrollY > 0) {
      touchStartY.current = null
      return
    }

    touchStartY.current = event.touches[0]?.clientY ?? null
  }

  const onTouchEnd: TouchEventHandler<HTMLDivElement> = (event) => {
    if (touchStartY.current === null) {
      return
    }

    const endY = event.changedTouches[0]?.clientY ?? touchStartY.current
    if (endY - touchStartY.current > 70) {
      refetch().catch(() => null)
    }

    touchStartY.current = null
  }

  if (loading && cards.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        title="Aucune carte fidélité"
        description="Scannez votre premier QR code pour rejoindre un programme."
      />
    )
  }

  return (
    <section onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total points</p>
          <p className="mt-1 text-4xl font-black text-slate-900">{totalPoints}</p>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            <p>LoyalUp: {loyaltyPoints}</p>
            <p>Partner: {partnerPoints}</p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{offline ? 'Hors ligne (cache)' : 'Dernière synchro: à l’instant'}</span>
            <PrimaryButton
              type="button"
              onClick={() => {
                refetch().catch(() => null)
              }}
              className="h-9"
            >
              Rafraîchir
            </PrimaryButton>
          </div>
        </div>
        <StatCard label="Programmes" value={String(cards.length)} helper="Cartes actives" />
      </div>

      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}

      <div className="space-y-3">
        {cards.map((card, index) => (
          <LoyaltyCard key={card.fournisseur.id} card={card} index={index} />
        ))}
      </div>
    </section>
  )
}
