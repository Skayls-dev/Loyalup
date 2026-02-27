import { useMemo } from 'react'
import { PromoTypeBadge } from './PromoTypeBadge'
import type { Promotion } from '../services/promotionService'

type PromoCardProps = {
  promotion: Promotion
  fournisseurNom: string
  isNew?: boolean
}

function getExpiryLabel(endIso: string): { label: string; urgent: boolean } {
  const end = new Date(endIso)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours <= 0) {
    return { label: 'Expirée', urgent: true }
  }

  if (diffHours < 24) {
    return { label: 'Expire ce soir', urgent: true }
  }

  const days = Math.ceil(diffHours / 24)
  return { label: `Expire dans ${days} jour${days > 1 ? 's' : ''}`, urgent: false }
}

export function PromoCard({ promotion, fournisseurNom, isNew = false }: PromoCardProps) {
  const expiry = useMemo(() => getExpiryLabel(promotion.date_fin), [promotion.date_fin])

  return (
    <article
      className={`w-72 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-4 ${
        isNew ? 'ring-1 ring-red-500/60' : ''
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-xs text-zinc-500">{fournisseurNom}</p>
        <PromoTypeBadge type={promotion.type} />
      </div>

      <p className="text-xl">{promotion.emoji}</p>
      <h3 className="mt-1 text-sm font-semibold text-zinc-100">{promotion.titre}</h3>
      <p className="mt-1 text-xs text-zinc-400">{promotion.description}</p>

      {promotion.valeur !== null ? (
        <p className="mt-2 text-xs font-semibold text-zinc-300">Valeur: {promotion.valeur}</p>
      ) : null}

      <p className={`mt-3 text-xs font-medium ${expiry.urgent ? 'text-red-400' : 'text-zinc-400'}`}>
        {expiry.label}
      </p>
    </article>
  )
}
