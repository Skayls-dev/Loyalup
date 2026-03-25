import { formatRelative } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { upsertMerchantRating } from '../../modules/ratings/services/ratingService'
import { useRecentTransactions } from '../../hooks/useRecentTransactions'

type RecentTransactionsProps = {
  userId?: string
  limit?: number
  className?: string
}

const relativeDateLocale: Locale = {
  ...fr,
  formatRelative: (token) => {
    const table: Record<string, string> = {
      lastWeek: "d MMM",
      yesterday: "'Hier'",
      today: "'Aujourd\'hui'",
      tomorrow: "d MMM",
      nextWeek: 'd MMM',
      other: 'd MMM',
    }

    return table[token] ?? table.other
  },
}

function formatTransactionDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const result = formatRelative(date, new Date(), { locale: relativeDateLocale })
  return result.charAt(0).toUpperCase() + result.slice(1)
}

export function RecentTransactions({ userId, limit = 4, className = '' }: RecentTransactionsProps) {
  const { user } = useAuth()
  const resolvedUserId = userId ?? user?.id
  const { transactions, loading, error } = useRecentTransactions(resolvedUserId, limit)
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({})
  const [submittingTxId, setSubmittingTxId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleRate(transactionId: string, rating: number) {
    setSubmitError(null)
    setSubmittingTxId(transactionId)

    try {
      await upsertMerchantRating({ transactionId, rating })
      setLocalRatings((prev) => ({ ...prev, [transactionId]: rating }))
    } catch (caughtError) {
      setSubmitError(caughtError instanceof Error ? caughtError.message : 'Impossible d\'enregistrer votre note.')
    } finally {
      setSubmittingTxId(null)
    }
  }

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Transactions récentes</p>
        <Link to="/history" className="font-body text-sm font-semibold text-primary transition hover:opacity-80">
          Historique →
        </Link>
      </div>

      <div className="divide-y divide-gray-200">
        {transactions.map((tx) => (
          <article key={tx.id} className="flex items-start gap-3 py-3 first:pt-2 last:pb-2">
            <div
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg"
              style={{ backgroundColor: `${tx.networkColor}22` }}
              aria-hidden="true"
            >
              {tx.merchantEmoji}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm font-semibold text-dark">
                {tx.transactionType === 'reward_redemption' && tx.serviceName ? tx.serviceName : tx.merchantName}
              </p>
              <p className="mt-0.5 font-body text-xs text-gray-500">{formatTransactionDate(tx.createdAt)}</p>

              {tx.canRate ? (
                <div className="mt-2 flex items-center gap-1" aria-label="Noter le marchand de 1 a 5 etoiles">
                  {([1, 2, 3, 4, 5] as const).map((star) => {
                    const selectedRating = localRatings[tx.id] ?? tx.ratingScore ?? 0
                    const filled = star <= selectedRating
                    const disabled = submittingTxId === tx.id

                    return (
                      <button
                        key={`${tx.id}-star-${star}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => void handleRate(tx.id, star)}
                        className={`text-base leading-none transition ${filled ? 'text-amber-500' : 'text-gray-300'} ${disabled ? 'cursor-wait opacity-70' : 'hover:scale-110'}`}
                        aria-label={`Noter ${star} sur 5`}
                        title={`Noter ${star} sur 5`}
                      >
                        ★
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              {tx.transactionType === 'reward_redemption' ? (
                <p className="font-body text-sm font-semibold text-amber-500">{tx.points.toLocaleString('fr-FR')} pts</p>
              ) : (
                <p className="font-body text-sm font-semibold text-accent-green">+{tx.points.toLocaleString('fr-FR')} pts</p>
              )}
              {tx.canRate && (localRatings[tx.id] ?? tx.ratingScore) ? (
                <p className="mt-1 font-body text-[11px] text-gray-500">Merci pour votre avis</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {loading ? <p className="pt-3 font-body text-xs text-gray-500">Chargement...</p> : null}
      {!loading && transactions.length === 0 ? (
        <p className="pt-3 font-body text-sm text-gray-500">Aucune transaction récente.</p>
      ) : null}
      {error ? <p className="pt-3 font-body text-xs text-rose-600">{error}</p> : null}
      {submitError ? <p className="pt-3 font-body text-xs text-rose-600">{submitError}</p> : null}
    </section>
  )
}
