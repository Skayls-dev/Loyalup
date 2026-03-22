import { Gift } from 'lucide-react'
import { useMemo } from 'react'
import { useRewards } from '../hooks/useRewards'
import { RewardCard } from './RewardCard'
import { EmptyState, SecondaryButton, Skeleton } from '../../../shared/components/client-ui'

type RewardListProps = {
  fournisseur_id?: string
}

export function RewardList({ fournisseur_id }: RewardListProps) {
  const { rewards, loading, useReward, error, refetch } = useRewards({ fournisseur_id })
  const orderedRewards = useMemo(() => {
    return [...rewards].sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'available' ? -1 : 1
      }

      if (left.points_needed !== right.points_needed) {
        return left.points_needed - right.points_needed
      }

      return left.reward_rule.points_required - right.reward_rule.points_required
    })
  }, [rewards])

  const availableCount = orderedRewards.filter((reward) => reward.status === 'available').length
  const closeCount = orderedRewards.filter((reward) => reward.status !== 'available' && reward.points_needed > 0 && reward.points_needed <= 25).length

  if (loading && orderedRewards.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
    )
  }

  if (orderedRewards.length === 0) {
    return (
      <EmptyState
        title="Aucune récompense disponible"
        description="Continuez vos achats pour débloquer vos prochaines récompenses."
        icon={<Gift className="h-5 w-5" />}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-2">
          <span>{orderedRewards.length} offre(s)</span>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
            {availableCount} disponible(s)
          </span>
          {closeCount > 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
              {closeCount} bientot debloquee(s)
            </span>
          ) : null}
        </div>
        <SecondaryButton
          type="button"
          onClick={() => {
            refetch().catch(() => null)
          }}
          className="h-9"
        >
          Rafraîchir
        </SecondaryButton>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}

      <div className="space-y-3">
        {orderedRewards.map((reward) => (
          <RewardCard key={reward.id} reward={reward} onUse={useReward} />
        ))}
      </div>
    </div>
  )
}
