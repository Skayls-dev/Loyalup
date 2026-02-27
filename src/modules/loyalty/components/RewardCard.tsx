import { CheckCircle2, Gift } from 'lucide-react'
import type { ClientReward } from '../services/loyaltyService'

type RewardCardProps = {
  reward: ClientReward
  onUse: (clientRewardId: string) => Promise<void>
}

export function RewardCard({ reward, onUse }: RewardCardProps) {
  const isAvailable = reward.status === 'available'
  const isNew = Date.now() - new Date(reward.unlocked_at).getTime() < 15000

  const handleUse = async () => {
    if (!isAvailable) {
      return
    }

    const confirmed = window.confirm('Utiliser cette récompense maintenant ?')
    if (!confirmed) {
      return
    }

    await onUse(reward.id)
  }

  return (
    <article
      className={`rounded-xl border p-4 transition ${
        isAvailable ? 'border-emerald-700 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-900 opacity-75'
      } ${isNew ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg">
            {reward.reward_rule.emoji} {reward.reward_rule.nom}
          </p>
          <p className="text-xs text-zinc-400">{reward.reward_rule.points_required} pts</p>
          <p className="mt-1 text-xs text-zinc-500">{reward.reward_rule.description}</p>
        </div>

        <span
          className={`rounded-full border px-2 py-1 text-xs ${
            isAvailable
              ? 'border-emerald-700 bg-emerald-900/50 text-emerald-300'
              : 'border-zinc-700 bg-zinc-800 text-zinc-300'
          }`}
        >
          {isAvailable ? 'Disponible' : 'Utilisé'}
        </span>
      </div>

      <div className="mt-3">
        {isAvailable ? (
          <button
            type="button"
            onClick={() => {
              handleUse().catch(() => null)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
          >
            <Gift className="h-4 w-4" />
            Utiliser
          </button>
        ) : (
          <p className="inline-flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle2 className="h-4 w-4" />
            Utilisée
          </p>
        )}
      </div>
    </article>
  )
}
