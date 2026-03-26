import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { useMerchantFeedback } from '../../hooks/useMerchantFeedback'

type MerchantFeedbackPanelProps = {
  merchantId: string
  averageRating: number
  ratingCount: number
  className?: string
}

type PeriodFilter = 7 | 30 | 'all'

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: 7, label: '7j' },
  { value: 30, label: '30j' },
  { value: 'all', label: 'Tout' },
]

function renderStars(rating: number): string {
  const rounded = Math.max(1, Math.min(5, Math.round(rating)))
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`
}

function anonymizeClientLabel(clientId: string | null): string {
  if (!clientId) return 'Client'
  return `Client #${clientId.slice(0, 6)}`
}

export function MerchantFeedbackPanel({
  merchantId,
  averageRating,
  ratingCount,
  className = '',
}: MerchantFeedbackPanelProps) {
  const { feedback, loading, error } = useMerchantFeedback(merchantId, 8)
  const [period, setPeriod] = useState<PeriodFilter>(30)

  const filteredFeedback = useMemo(() => {
    if (period === 'all') return feedback

    const threshold = Date.now() - period * 24 * 60 * 60 * 1000
    return feedback.filter((item) => new Date(item.createdAt).getTime() >= threshold)
  }, [feedback, period])

  return (
    <section className={`rounded-[16px] border border-gray-200 bg-white p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">Avis clients</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-dark">Feedback recents</h2>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-right">
          <p className="font-body text-xs uppercase tracking-[0.12em] text-gray-500">Moyenne</p>
          <p className="mt-1 font-display text-xl font-extrabold text-dark">
            {ratingCount > 0 ? `${averageRating.toFixed(1)} / 5` : 'N/A'}
          </p>
          <p className="font-body text-xs text-gray-500">{ratingCount.toLocaleString('fr-FR')} avis</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            {periodOptions.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  period === option.value ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="font-body text-xs text-gray-500">{filteredFeedback.length.toLocaleString('fr-FR')} avis</p>
        </div>

        {filteredFeedback.map((item) => (
          <article key={item.id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-body text-sm font-semibold text-dark">{anonymizeClientLabel(item.clientId)}</p>
              <p className="font-body text-xs text-gray-500">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: fr })}
              </p>
            </div>
            <p className="mt-1 font-body text-sm text-amber-500">{renderStars(item.rating)}</p>
            {item.comment ? <p className="mt-2 font-body text-sm text-gray-700">{item.comment}</p> : null}
          </article>
        ))}
      </div>

      {loading ? <p className="pt-3 font-body text-xs text-gray-500">Chargement des avis...</p> : null}
      {!loading && filteredFeedback.length === 0 ? (
        <p className="pt-3 font-body text-sm text-gray-500">Aucun feedback client pour le moment.</p>
      ) : null}
      {error ? <p className="pt-3 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
