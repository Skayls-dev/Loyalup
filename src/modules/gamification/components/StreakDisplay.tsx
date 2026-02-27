import { useStreak } from '../hooks'

interface StreakDisplayProps {
  showWarning?: boolean
  language?: string
}

export function StreakDisplay({ 
  showWarning = true, 
  language = 'fr' 
}: StreakDisplayProps) {
  const { streak, loading, error } = useStreak()

  if (loading) {
    return <div className="text-center py-4">Chargement de votre série...</div>
  }

  if (error) {
    return <div className="text-center py-4 text-red-600">Erreur lors du chargement</div>
  }

  if (!streak) return null

  return (
    <div className="space-y-4">
      {/* Current streak */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg border border-orange-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-gray-800">🔥 Série en cours</h3>
          {showWarning && streak.is_at_risk && (
            <span className="text-xs font-bold text-red-600">⚠️ À risque!</span>
          )}
        </div>

        <div className="text-3xl font-bold text-orange-600">{streak.current}</div>
        <p className="text-sm text-gray-700 mt-1">jours consécutifs de visites</p>

        {streak.last_visit && (
          <p className="text-xs text-gray-600 mt-2">
            Dernière visite:{' '}
            {streak.last_visit.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
          </p>
        )}

        {showWarning && streak.is_at_risk && (
          <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800 font-semibold">
            N'oubliez pas de scanner demain pour maintenir votre série! 📷
          </div>
        )}
      </div>

      {/* Record */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
        <h4 className="font-bold text-gray-800 text-sm">🏆 Record personnel</h4>
        <div className="text-2xl font-bold text-purple-600 mt-2">{streak.longest}</div>
        <p className="text-sm text-gray-700">jours consécutifs</p>
      </div>

      {/* Milestones */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="font-bold text-gray-800 text-sm mb-3">📊 Prochaines étapes</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">7 jours</span>
            <div className="flex-1 mx-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{
                  width: `${Math.min(100, (streak.current / 7) * 100)}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-600">🎖️</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-700">30 jours</span>
            <div className="flex-1 mx-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{
                  width: `${Math.min(100, (streak.current / 30) * 100)}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-600">🌟</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-700">100 jours</span>
            <div className="flex-1 mx-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{
                  width: `${Math.min(100, (streak.current / 100) * 100)}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-600">👑</span>
          </div>
        </div>
      </div>
    </div>
  )
}

