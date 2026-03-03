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
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {typeEmojis[t]} {typeLabels[t].split(' ').pop()}
          </button>
        ))}
      </div>

      {loading && <div className="rounded-2xl border border-white/70 bg-white/85 py-8 text-center text-slate-600">Chargement du classement...</div>}

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 py-8 text-center text-rose-700">Erreur lors du chargement du classement</div>}

      {!loading && !error && (
        <>
          {/* My rank */}
          {myRank && myScore !== null && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-700">
                  #{myRank}
                </div>
                <div className="text-4xl font-bold text-amber-700">{myScore}</div>
                <p className="mt-1 text-sm font-semibold text-amber-700">
                  Votre position
                </p>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="space-y-2">
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-white/70 bg-white/85 py-8 text-center text-slate-600">
                Aucune donnée disponible pour le moment
              </div>
            ) : (
              entries.map((entry, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 flex items-center justify-between transition-all ${
                    entry.is_current_user
                      ? 'bg-indigo-50 border-indigo-200'
                      : idx < 3
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-2xl font-bold w-12 text-right">
                      {idx < 3 ? medalEmojis[idx] : `#${entry.rank}`}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">
                        {entry.client_name}
                        {entry.is_current_user && (
                          <span className="ml-2 rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
                            Vous
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">
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

