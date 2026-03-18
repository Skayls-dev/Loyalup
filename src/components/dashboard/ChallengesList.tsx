import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useChallenges } from '../../hooks/useChallenges'

export interface ChallengesListProps {
  userId?: string
  className?: string
}

export function ChallengesList({ userId, className = '' }: ChallengesListProps) {
  const { user } = useAuth()
  const resolvedUserId = userId ?? user?.id
  const { challenges, loading, error } = useChallenges(resolvedUserId)

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <p className="mb-3 font-body text-xs uppercase tracking-[0.16em] text-gray-500">Défis actifs</p>

      <div className="space-y-3">
        {challenges.map((challenge) => {
          const progress = Math.max(0, Math.min(100, Math.round((challenge.current / challenge.target) * 100)))
          return (
            <article key={challenge.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-dark">
                    <span className="mr-2">{challenge.icon}</span>
                    {challenge.name}
                  </p>
                  <p className="mt-1 font-body text-xs text-gray-600">
                    {challenge.current.toLocaleString('fr-FR')} / {challenge.target.toLocaleString('fr-FR')} complétés
                  </p>
                </div>
                <p className="shrink-0 font-body text-xs font-semibold text-primary">+{challenge.rewardPoints} pts</p>
              </div>

              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
            </article>
          )
        })}
      </div>

      {loading ? <p className="mt-3 font-body text-xs text-gray-500">Chargement...</p> : null}
      {!loading && challenges.length === 0 ? (
        <p className="mt-3 font-body text-sm text-gray-500">Aucun défi actif pour le moment.</p>
      ) : null}
      {error ? <p className="mt-3 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
