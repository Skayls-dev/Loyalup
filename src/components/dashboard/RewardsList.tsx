import { useMemo, useState } from 'react'

export interface RewardListItem {
  id: string
  emoji: string
  name: string
  merchant: string
  costPoints: number
  featured?: boolean
}

export interface RewardsListProps {
  rewards: RewardListItem[]
  className?: string
}

export function RewardsList({ rewards, className = '' }: RewardsListProps) {
  const [selectedReward, setSelectedReward] = useState<RewardListItem | null>(null)

  const orderedRewards = useMemo(() => {
    return [...rewards].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
  }, [rewards])

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <p className="mb-3 font-body text-xs uppercase tracking-[0.16em] text-gray-500">Récompenses disponibles</p>

      <div className="space-y-2">
        {orderedRewards.map((reward) => {
          const isFeatured = reward.featured || /platinum upgrade/i.test(reward.name)

          return (
            <button
              key={reward.id}
              type="button"
              onClick={() => setSelectedReward(reward)}
              className={`group w-full rounded-md border px-3 py-3 text-left transition-all ${
                isFeatured
                  ? 'border-primary/50 bg-gradient-to-r from-primary-light to-white hover:border-primary hover:shadow-floating'
                  : 'border-gray-200 bg-white hover:border-primary/60 hover:bg-primary-light/35'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-dark">
                    <span className="mr-2">{reward.emoji}</span>
                    {reward.name}
                  </p>
                  <p className="mt-0.5 truncate font-body text-xs text-gray-600">{reward.merchant}</p>
                </div>
                <p className={`shrink-0 font-body text-sm font-semibold ${isFeatured ? 'text-accent-orange' : 'text-primary'}`}>
                  {reward.costPoints.toLocaleString('fr-FR')} pts
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {orderedRewards.length === 0 ? (
        <p className="mt-3 font-body text-sm text-gray-500">Aucune récompense disponible.</p>
      ) : null}

      {selectedReward ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/45 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-card">
            <h3 className="font-display text-xl font-bold text-dark">Confirmer le rachat</h3>
            <p className="mt-2 font-body text-sm text-gray-600">
              Voulez-vous utiliser {selectedReward.costPoints.toLocaleString('fr-FR')} pts pour « {selectedReward.name} » ?
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedReward(null)}
                className="rounded-md border border-gray-200 px-4 py-2 font-body text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => setSelectedReward(null)}
                className="rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-white shadow-primary-glow transition hover:brightness-105"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
