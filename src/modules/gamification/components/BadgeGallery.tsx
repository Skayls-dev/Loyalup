import { useState } from 'react'
import { BadgeCard } from './BadgeCard'
import { useBadges } from '../hooks'

interface BadgeGalleryProps {
  language?: string
}

export function BadgeGallery({ language = 'fr' }: BadgeGalleryProps) {
  const { earned, locked, total, loading, error } = useBadges()
  const [showLocked, setShowLocked] = useState(false)

  if (loading) {
    return <div className="text-center py-8">Chargement des badges...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Erreur lors du chargement des badges</div>
  }

  const earnedCount = earned.length
  const completionPercent = Math.round((earnedCount / total) * 100)

  return (
    <div className="space-y-6">
      {/* Stats header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
        <div className="flex items-justify justify-between mb-2">
          <h3 className="font-bold text-gray-800">🏆 Collection de Badges</h3>
          <span className="text-sm font-semibold text-gray-700">
            {earnedCount}/{total}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <div className="text-xs text-gray-600 mt-2">{completionPercent}% complété</div>
      </div>

      {/* Earned badges */}
      {earnedCount > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-4">Débloqués ({earnedCount})</h4>
          <div className="flex flex-wrap gap-6">
            {earned.map((badge) => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                earned
                language={language}
              />
            ))}
          </div>
        </div>
      )}

      {/* Locked badges toggle */}
      {locked.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowLocked(!showLocked)}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold text-gray-700 transition-colors"
          >
            {showLocked ? '△' : '▽'} Badges à déverrouiller ({locked.length})
          </button>

          {showLocked && (
            <div className="flex flex-wrap gap-6">
              {locked.map((badge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  earned={false}
                  locked
                  language={language}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

