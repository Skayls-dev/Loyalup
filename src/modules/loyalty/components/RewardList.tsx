import { Gift } from 'lucide-react'
import { useRewards } from '../hooks/useRewards'
import { RewardCard } from './RewardCard'

type RewardListProps = {
  fournisseur_id?: string
}

export function RewardList({ fournisseur_id }: RewardListProps) {
  const { rewards, loading, useReward, error, refetch } = useRewards({ fournisseur_id })

  if (loading && rewards.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-zinc-800/70" />
        ))}
      </div>
    )
  }

  if (rewards.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <Gift className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
        <p className="text-sm text-zinc-300">Aucune récompense disponible.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{rewards.length} récompense(s)</span>
        <button
          type="button"
          onClick={() => {
            refetch().catch(() => null)
          }}
          className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300"
        >
          Rafraîchir
        </button>
      </div>

      {error ? <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p> : null}

      <div className="space-y-3">
        {rewards.map((reward) => (
          <RewardCard key={reward.id} reward={reward} onUse={useReward} />
        ))}
      </div>
    </div>
  )
}
