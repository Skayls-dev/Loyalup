import { formatRelative } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { useMemo, useState } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useClientFeedbackHistory } from '../../hooks/useClientFeedbackHistory'

type ClientFeedbackHistoryProps = {
  userId?: string
  limit?: number
  className?: string
}

type PeriodFilter = 7 | 30 | 'all'

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: 7, label: '7j' },
  { value: 30, label: '30j' },
  { value: 'all', label: 'Tout' },
]

const relativeDateLocale: Locale = {
  ...fr,
  formatRelative: (token) => {
    const table: Record<string, string> = {
      lastWeek: 'd MMM',
      yesterday: "'Hier'",
      today: "'Aujourd\'hui'",
      tomorrow: 'd MMM',
      nextWeek: 'd MMM',
      other: 'd MMM',
    }

    return table[token] ?? table.other
  },
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const result = formatRelative(date, new Date(), { locale: relativeDateLocale })
  return result.charAt(0).toUpperCase() + result.slice(1)
}

function stars(rating: number): string {
  const value = Math.max(1, Math.min(5, Math.round(rating)))
  return `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`
}

export function ClientFeedbackHistory({ userId, limit = 12, className = '' }: ClientFeedbackHistoryProps) {
  const { user } = useAuth()
  const resolvedUserId = userId ?? user?.id
  const { feedback, loading, error } = useClientFeedbackHistory(resolvedUserId, limit)
  const [period, setPeriod] = useState<PeriodFilter>(30)

  const filteredFeedback = useMemo(() => {
    if (period === 'all') return feedback

    const threshold = Date.now() - period * 24 * 60 * 60 * 1000
    return feedback.filter((item) => new Date(item.createdAt).getTime() >= threshold)
  }, [feedback, period])

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="mb-2">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Vos avis</p>
        <p className="mt-1 font-body text-sm text-gray-600">Les feedbacks que vous avez deja laisses aux marchands.</p>
      </div>

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

      <div className="divide-y divide-gray-200">
        {filteredFeedback.map((item) => (
          <article key={item.id} className="py-3 first:pt-2 last:pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-body text-sm font-semibold text-dark">{item.merchantName}</p>
              <p className="font-body text-xs text-gray-500">{formatDate(item.createdAt)}</p>
            </div>
            <p className="mt-1 font-body text-sm text-amber-500">{stars(item.rating)}</p>
            {item.comment ? <p className="mt-1 font-body text-sm text-gray-600">{item.comment}</p> : null}
          </article>
        ))}
      </div>

      {loading ? <p className="pt-3 font-body text-xs text-gray-500">Chargement...</p> : null}
      {!loading && filteredFeedback.length === 0 ? <p className="pt-3 font-body text-sm text-gray-500">Aucun avis pour le moment.</p> : null}
      {error ? <p className="pt-3 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
