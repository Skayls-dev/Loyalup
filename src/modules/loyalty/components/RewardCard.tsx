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
        isAvailable ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white/80 opacity-75'
      } ${isNew ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg">
            {reward.reward_rule.emoji} {reward.reward_rule.nom}
          </p>
          <p className="text-xs text-slate-500">{reward.reward_rule.points_required} pts</p>
          <p className="mt-1 text-xs text-slate-500">{reward.reward_rule.description}</p>
        </div>

        <span
          className={`rounded-full border px-2 py-1 text-xs ${
            isAvailable
              ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
              : 'border-slate-200 bg-slate-100 text-slate-600'
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
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            <Gift className="h-4 w-4" />
            Utiliser
          </button>
        ) : (
          <p className="inline-flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-4 w-4" />
            Utilisée
          </p>
        )}
      </div>
    </article>
  )
}
