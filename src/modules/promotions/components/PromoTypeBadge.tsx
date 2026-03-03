import type { PromotionType } from '../services/promotionService'

type PromoTypeBadgeProps = {
  type: PromotionType
}

const badgeMap: Record<PromotionType, { label: string; className: string }> = {
  double_points: {
    label: '✦ Double points',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  discount: {
    label: '% Réduction',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  free_item: {
    label: '🎁 Article offert',
    className: 'border-teal-200 bg-teal-50 text-teal-700',
  },
  custom: {
    label: '⭐ Offre spéciale',
    className: 'border-purple-200 bg-purple-50 text-purple-700',
  },
}

export function PromoTypeBadge({ type }: PromoTypeBadgeProps) {
  const badge = badgeMap[type]

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badge.className}`}>
      {badge.label}
    </span>
  )
}
