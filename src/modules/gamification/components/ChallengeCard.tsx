import type { ChallengeData } from '../services/gamificationService'

interface ChallengeCardProps {
  challenge: ChallengeData
  language?: string
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Terminé'

  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}j ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function ChallengeCard({ challenge, language = 'fr' }: ChallengeCardProps) {
  const isCritical = challenge.time_remaining_ms < 1000 * 60 * 60 * 24 // <1 day
  const isCompleted = challenge.completed

  return (
    <div
      className={`p-4 rounded-lg border-2 transition-all ${
        isCompleted
          ? 'bg-green-50 border-green-300'
          : isCritical
            ? 'bg-red-50 border-red-300'
            : 'bg-white border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{challenge.emoji}</span>
          <div>
            <h4 className="font-bold text-gray-800">{challenge.title[language] ?? challenge.title['fr']}</h4>
            <p className="text-xs text-gray-600">{challenge.description[language] ?? challenge.description['fr']}</p>
          </div>
        </div>
        {isCompleted && <span className="text-xl">✅</span>}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-700 font-semibold">Progression</span>
          <span className="text-gray-600">
            {challenge.current_value} / {challenge.target_value}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isCompleted
                ? 'bg-green-500'
                : isCritical
                  ? 'bg-red-500'
                  : 'bg-blue-500'
            }`}
            style={{ width: `${challenge.progress_pct}%` }}
          />
        </div>
      </div>

      {/* Rewards & timer */}
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
        <div className="text-center">
          <div className="text-yellow-600">+{challenge.reward_points}</div>
          <div className="text-gray-600">Points</div>
        </div>
        <div className="text-center border-l border-r border-gray-200">
          <div className="text-purple-600">+{challenge.reward_xp} XP</div>
          <div className="text-gray-600">Expérience</div>
        </div>
        <div className={`text-center text-right ${isCritical ? 'text-red-600' : 'text-gray-600'}`}>
          <div>{formatTimeRemaining(challenge.time_remaining_ms)}</div>
          <div>Restant</div>
        </div>
      </div>
    </div>
  )
}

