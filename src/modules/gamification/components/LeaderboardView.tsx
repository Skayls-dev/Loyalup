import { useState } from 'react'
import { useLeaderboard } from '../hooks'

type LeaderboardType = 'global_xp' | 'global_points' | 'referrals' | 'streak'

interface LeaderboardViewProps {
  type?: LeaderboardType
  fournisseurId?: string
}

const typeLabels: Record<LeaderboardType, string> = {
  global_xp: '⭐ Expérience Globale',
  global_points: '💰 Points Globaux',
  referrals: '👥 Parrainages',
  streak: '🔥 Séries',
}

const typeEmojis: Record<LeaderboardType, string> = {
  global_xp: '⭐',
  global_points: '💰',
  referrals: '👥',
  streak: '🔥',
}

export function LeaderboardView({
  type = 'global_xp',
  fournisseurId,
}: LeaderboardViewProps) {
  const [selectedType, setSelectedType] = useState<LeaderboardType>(type)
  const { entries, myRank, myScore, loading, error } = useLeaderboard(selectedType, fournisseurId)

  const medalEmojis = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(Object.keys(typeLabels) as LeaderboardType[]).map((t) => (
          <button
            key={t}
            onClick={() => setSelectedType(t)}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-semibold transition-all flex-shrink-0 ${
              selectedType === t
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {typeEmojis[t]} {typeLabels[t].split(' ').pop()}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-8">Chargement du classement...</div>}

      {error && (
        <div className="text-center py-8 text-red-600">
          Erreur lors du chargement du classement
        </div>
      )}

      {!loading && !error && (
        <>
          {/* My rank */}
          {myRank && myScore !== null && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-lg border-2 border-amber-300">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">
                  #{myRank}
                </div>
                <div className="text-4xl font-bold text-amber-600">{myScore}</div>
                <p className="text-sm text-amber-700 font-semibold mt-1">
                  Votre position
                </p>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="space-y-2">
            {entries.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                Aucune donnée disponible pour le moment
              </div>
            ) : (
              entries.map((entry, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 flex items-center justify-between transition-all ${
                    entry.is_current_user
                      ? 'bg-blue-50 border-blue-300'
                      : idx < 3
                        ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300'
                        : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-2xl font-bold w-12 text-right">
                      {idx < 3 ? medalEmojis[idx] : `#${entry.rank}`}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">
                        {entry.client_name}
                        {entry.is_current_user && (
                          <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
                            Vous
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-800">
                      {entry.score.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

