import { memo } from 'react'
import type { TransactionHistoryItem } from '../services/loyaltyService'

type TransactionItemProps = {
  transaction: TransactionHistoryItem
}

function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startYesterday = new Date(startToday)
  startYesterday.setDate(startYesterday.getDate() - 1)

  if (date >= startToday) {
    return `Aujourd'hui ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  if (date >= startYesterday) {
    return 'Hier'
  }

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function TransactionItemComponent({ transaction }: TransactionItemProps) {
  const isDebit = transaction.points_credited < 0

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          <span className="mr-2">{transaction.service_emoji}</span>
          {transaction.service_nom}
        </p>
        <p className="text-xs text-slate-500">{formatDateLabel(transaction.created_at)}</p>
        <p className="text-xs text-slate-500">{transaction.montant.toFixed(2)} €</p>
      </div>

      <div className={`text-sm font-semibold ${isDebit ? 'text-rose-600' : 'text-emerald-600'}`}>
        {isDebit ? '' : '+'}
        {transaction.points_credited} pts
      </div>
    </div>
  )
}

export const TransactionItem = memo(TransactionItemComponent)
