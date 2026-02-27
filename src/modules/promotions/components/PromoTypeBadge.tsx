import type { PromotionType } from '../services/promotionService'

type PromoTypeBadgeProps = {
  type: PromotionType
}

const badgeMap: Record<PromotionType, { label: string; className: string }> = {
  double_points: {
    label: '✦ Double points',
    className: 'border-amber-700 bg-amber-950/60 text-amber-300',
  },
  discount: {
    label: '% Réduction',
    className: 'border-orange-700 bg-orange-950/60 text-orange-300',
  },
  free_item: {
    label: '🎁 Article offert',
    className: 'border-teal-700 bg-teal-950/60 text-teal-300',
  },
  custom: {
    label: '⭐ Offre spéciale',
    className: 'border-purple-700 bg-purple-950/60 text-purple-300',
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
