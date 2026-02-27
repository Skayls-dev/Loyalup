import { ChallengeCard } from './ChallengeCard'
import { useChallenges } from '../hooks'

interface ChallengeListProps {
  language?: string
  maxVisible?: number
}

export function ChallengeList({ language = 'fr', maxVisible }: ChallengeListProps) {
  const { challenges, loading, error } = useChallenges()

  if (loading) {
    return <div className="text-center py-8">Chargement des défis...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Erreur lors du chargement des défis</div>
  }

  if (challenges.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        Aucun défi actif pour le moment. Revenez plus tard! 🎯
      </div>
    )
  }

  const visibleChallenges = maxVisible
    ? challenges.slice(0, maxVisible)
    : challenges

  const completedCount = challenges.filter((c) => c.completed).length

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">🎯 Défis Actifs</h3>
        <span className="text-sm font-semibold text-gray-700">
          {completedCount}/{challenges.length}
        </span>
      </div>

      {/* Challenge list */}
      <div className="space-y-3">
        {visibleChallenges.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            language={language}
          />
        ))}
      </div>

      {/* Show more button */}
      {maxVisible && challenges.length > maxVisible && (
        <button className="w-full py-2 text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors">
          Voir tous les défis ({challenges.length})
        </button>
      )}
    </div>
  )
}

