import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMerchantTransactions, type MerchantTier } from '../../hooks/useMerchantTransactions'

export interface MerchantTransactionsProps {
  merchantId: string
  limit?: number
  className?: string
  headerAction?: React.ReactNode
}

const tierStyles: Record<MerchantTier, { bg: string; text: string }> = {
  Gold: { bg: '#FAEEDA', text: '#633806' },
  Silver: { bg: '#F1F3F9', text: '#444441' },
  Bronze: { bg: '#FAECE7', text: '#712B13' },
}

const avatarPalette = ['#FFEDD5', '#E9E7FF', '#E1F5EE', '#FBEAF0']

function initialsFromName(name: string): string {
  const parts = name
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return 'CL'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function colorFromName(name: string): string {
  const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return avatarPalette[sum % avatarPalette.length] ?? avatarPalette[0]
}

function relativeTime(dateIso: string): string {
  const parsed = new Date(dateIso)
  if (Number.isNaN(parsed.getTime())) return ''
  return formatDistanceToNow(parsed, { addSuffix: true, locale: fr })
}

export function MerchantTransactions({ merchantId, limit = 4, className = '', headerAction }: MerchantTransactionsProps) {
  const { transactions, loading, error } = useMerchantTransactions(merchantId, limit)

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Transactions récentes</p>
        {headerAction}
      </div>

      <div className="divide-y divide-gray-200">
        {transactions.map((tx) => {
          const tierStyle = tierStyles[tx.tier]
          const initials = initialsFromName(tx.customerName)
          const avatarBg = colorFromName(tx.customerName)

          return (
            <article key={tx.id} className="flex items-center gap-3 py-3 first:pt-2 last:pb-2">
              <div
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-body text-xs font-semibold text-dark"
                style={{ backgroundColor: avatarBg }}
                aria-hidden="true"
              >
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-body text-sm font-semibold text-dark">{tx.customerName}</p>
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: tierStyle.bg, color: tierStyle.text }}
                  >
                    {tx.tier}
                  </span>
                </div>

                <p className="mt-0.5 truncate font-body text-xs text-gray-500">
                  {relativeTime(tx.createdAt)} · {tx.networkName}
                </p>
              </div>

              <div className="text-right">
                {tx.transactionType === 'reward_redemption' ? (
                  <>
                    <p className="font-body text-sm font-semibold text-amber-500">
                      {tx.pointsGiven.toLocaleString('fr-FR')} pts
                    </p>
                    <p className="mt-0.5 font-body text-xs text-amber-400">Récompense utilisée</p>
                  </>
                ) : (
                  <>
                    <p className="font-body text-sm font-semibold text-accent-green">+{tx.pointsGiven.toLocaleString('fr-FR')} pts</p>
                    <p className="mt-0.5 font-body text-xs text-gray-500">{tx.amount.toLocaleString('fr-FR')} €</p>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {loading ? <p className="pt-3 font-body text-xs text-gray-500">Chargement...</p> : null}
      {!loading && transactions.length === 0 ? (
        <p className="pt-3 font-body text-sm text-gray-500">Aucune transaction récente.</p>
      ) : null}
      {error ? <p className="pt-3 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
