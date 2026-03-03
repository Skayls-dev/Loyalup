import { Gift } from 'lucide-react'
import { useRewards } from '../hooks/useRewards'
import { RewardCard } from './RewardCard'
import { EmptyState, SecondaryButton, Skeleton } from '../../../shared/components/client-ui'

type RewardListProps = {
  fournisseur_id?: string
}

export function RewardList({ fournisseur_id }: RewardListProps) {
  const { rewards, loading, useReward, error, refetch } = useRewards({ fournisseur_id })

  if (loading && rewards.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
    )
  }

  if (rewards.length === 0) {
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
        <span>{rewards.length} récompense(s)</span>
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
        {rewards.map((reward) => (
          <RewardCard key={reward.id} reward={reward} onUse={useReward} />
        ))}
      </div>
    </div>
  )
}
