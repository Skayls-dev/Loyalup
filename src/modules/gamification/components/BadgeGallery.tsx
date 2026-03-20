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
  const completionPercent = total > 0 ? Math.round((earnedCount / total) * 100) : 0
  const sortedEarned = [...earned].sort((a, b) => {
    const aTs = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0
    const bTs = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0
    return bTs - aTs
  })

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-50 via-indigo-50 to-violet-50 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-800">🏆 Collection de Badges</h3>
          <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-semibold text-slate-700">
            {earnedCount}/{total}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-300">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-300"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>{completionPercent}% complété</span>
          <span>•</span>
          <span>{earnedCount} débloqués</span>
          <span>•</span>
          <span>{locked.length} restants</span>
        </div>
      </div>

      {earnedCount > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Débloqués ({earnedCount})</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {sortedEarned.map((badge) => (
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

      {earnedCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
          {language === 'fr' ? 'Aucun badge débloqué pour le moment. Continuez vos activités pour gagner vos premiers badges.' : 'No unlocked badges yet. Keep going to earn your first badges.'}
        </div>
      ) : null}

      {locked.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowLocked(!showLocked)}
            className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
          >
            {showLocked ? '△' : '▽'} {language === 'fr' ? 'Badges à déverrouiller' : 'Locked badges'} ({locked.length})
          </button>

          {showLocked && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
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

