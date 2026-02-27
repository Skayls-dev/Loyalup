import { useRef } from 'react'
import type { TouchEventHandler } from 'react'
import { useLoyalty } from '../hooks/useLoyalty'
import { LoyaltyCard } from './LoyaltyCard'

export function LoyaltyCardList() {
  const { cards, loading, error, totalPoints, refetch, offline } = useLoyalty()
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
          <div key={index} className="h-40 animate-pulse rounded-2xl bg-zinc-800/70" />
        ))}
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-300">
        Scannez votre premier QR code pour rejoindre un programme
      </div>
    )
  }

  return (
    <section onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="space-y-3">
      <header className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Total points</p>
        <p className="text-3xl font-black text-zinc-100">{totalPoints}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">{offline ? 'Offline (cache)' : 'Synchronisé'}</span>
          <button
            type="button"
            onClick={() => {
              refetch().catch(() => null)
            }}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
          >
            Rafraîchir
          </button>
        </div>
      </header>

      {error ? <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p> : null}

      <div className="space-y-3">
        {cards.map((card, index) => (
          <LoyaltyCard key={card.fournisseur.id} card={card} index={index} />
        ))}
      </div>
    </section>
  )
}
