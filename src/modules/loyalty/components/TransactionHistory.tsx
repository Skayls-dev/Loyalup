import { History } from 'lucide-react'
import { useMemo, useRef } from 'react'
import type { TouchEventHandler } from 'react'
import { useTransactionHistory } from '../hooks/useTransactionHistory'
import { TransactionItem } from './TransactionItem'
import { EmptyState, SecondaryButton, Skeleton } from '../../../shared/components/client-ui'

type TransactionHistoryProps = {
  fournisseur_id?: string
}

function groupLabel(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startYesterday = new Date(startToday)
  startYesterday.setDate(startYesterday.getDate() - 1)

  if (date >= startToday) {
    return "Aujourd'hui"
  }

  if (date >= startYesterday) {
    return 'Hier'
  }

  const startWeek = new Date(startToday)
  const day = startWeek.getDay() || 7
  startWeek.setDate(startWeek.getDate() - (day - 1))

  if (date >= startWeek) {
    return 'Cette semaine'
  }

  return 'Plus ancien'
}

export function TransactionHistory({ fournisseur_id }: TransactionHistoryProps) {
  const { transactions, loading, hasMore, loadMore, refresh, error, offline } = useTransactionHistory({ fournisseur_id })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const touchStartY = useRef<number | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, typeof transactions>()

    for (const transaction of transactions) {
      const label = groupLabel(transaction.created_at)
      const existing = map.get(label) ?? []
      existing.push(transaction)
      map.set(label, existing)
    }

    return Array.from(map.entries())
  }, [transactions])

  const handleScroll = async () => {
    const container = containerRef.current
    if (!container || !hasMore || loading) {
      return
    }

    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight
    if (remaining < 120) {
      await loadMore()
    }
  }

  const onTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    const container = containerRef.current
    if (!container || container.scrollTop > 0) {
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
      refresh().catch(() => null)
    }

    touchStartY.current = null
  }

  if (loading && transactions.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    )
  }

  if (error && transactions.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
        <SecondaryButton type="button" onClick={() => refresh().catch(() => null)} className="h-8 px-3">
          Réessayer
        </SecondaryButton>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Aucune transaction"
        description="Vos prochains passages en caisse apparaîtront ici."
        icon={<History className="h-5 w-5" />}
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{offline ? 'Offline (cache)' : 'Synchronisé'}</span>
        <SecondaryButton type="button" onClick={() => refresh().catch(() => null)} className="h-8 px-3">
          Rafraîchir
        </SecondaryButton>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}

      <div
        ref={containerRef}
        onScroll={() => {
          handleScroll().catch(() => null)
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="max-h-[60vh] overflow-y-auto rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/5 backdrop-blur"
      >
        {grouped.map(([label, rows]) => (
          <section key={label} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
            <div className="space-y-0">
              {rows.map((row) => (
                <TransactionItem key={row.id} transaction={row} />
              ))}
            </div>
          </section>
        ))}

        {hasMore ? <p className="py-2 text-center text-xs text-slate-500">Faites défiler pour charger plus</p> : null}
      </div>
    </div>
  )
}
