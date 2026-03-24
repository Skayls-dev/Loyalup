import { useMemo } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import {
  BadgeGallery as BadgeGalleryView,
  ChallengeList,
  LevelBadge,
  StreakDisplay,
  XPProgressBar,
  LeaderboardView,
} from '../../modules/gamification/components'
import { useClientLevel } from '../../modules/gamification/hooks'
import { NetworkLeaderboard } from '../../modules/networks/components/client/NetworkLeaderboard'
import { useDashboard } from '../../hooks/useDashboard'
import { PageHeader, SectionCard, SecondaryButton } from '../../shared/components/client-ui'

type UseGamificationResult = {
  activeNetworkId: string | null
  loading: boolean
  error: string | null
}

function useGamification(userId: string): UseGamificationResult {
  const { networks, isLoading, error } = useDashboard(userId)

  const activeNetworkId = useMemo(() => {
    if (!networks.length) return null
    return networks[0]?.id ?? null
  }, [networks])

  return {
    activeNetworkId,
    loading: isLoading,
    error,
  }
}

function Topbar() {
  return (
    <PageHeader
      title="Défis & progression"
      subtitle="Suivez vos niveaux, badges, séries et votre rang réseau"
      rightActions={<SecondaryButton type="button">🏆 Classement</SecondaryButton>}
    />
  )
}

function TierHero({ userId }: { userId: string }) {
  const { levelData, loading, error } = useClientLevel()

  return (
    <SectionCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau actuel</p>
          <h2 className="text-xl font-semibold text-slate-900">Votre progression</h2>
        </div>
        {levelData ? (
          <LevelBadge
            level={levelData.current_level}
            emoji={levelData.level_emoji}
            color={levelData.level_color}
            size="md"
          />
        ) : null}
      </div>

      {loading ? <p className="text-sm text-slate-500">Chargement de votre niveau...</p> : null}
      {error ? <p className="text-sm text-rose-600">Erreur lors du chargement du niveau.</p> : null}

      {levelData ? (
        <>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">
              {levelData.level_name.fr ?? levelData.level_name.en ?? 'Niveau'}
            </p>
            <p className="text-xs text-slate-500">
              Utilisateur {userId.slice(0, 8)} • {levelData.xp_total.toLocaleString('fr-FR')} XP
            </p>
          </div>
          <XPProgressBar
            current={levelData.xp_total}
            target={levelData.xp_total + levelData.xp_to_next_level}
            percent={levelData.progress_pct}
          />
        </>
      ) : null}
    </SectionCard>
  )
}

function ChallengesSection({ userId }: { userId: string }) {
  return (
    <SectionCard className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Défis</h3>
        <span className="text-xs text-slate-500">User {userId.slice(0, 8)}</span>
      </div>
      <ChallengeList language="fr" />
    </SectionCard>
  )
}

function BadgesGallery({ userId }: { userId: string }) {
  return (
    <SectionCard className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Badges</h3>
        <span className="text-xs text-slate-500">User {userId.slice(0, 8)}</span>
      </div>
      <BadgeGalleryView language="fr" />
    </SectionCard>
  )
}

function Leaderboard({ networkId, userId }: { networkId: string | null; userId: string }) {
  return (
    <SectionCard className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Classement</h3>
        <span className="text-xs text-slate-500">User {userId.slice(0, 8)}</span>
      </div>

      {networkId ? (
        <NetworkLeaderboard network_id={networkId} />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            Aucun réseau actif détecté, affichage du classement global.
          </p>
          <LeaderboardView type="global_xp" />
        </div>
      )}
    </SectionCard>
  )
}

function StreakCard({ userId }: { userId: string }) {
  return (
    <SectionCard className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Série</h3>
        <span className="text-xs text-slate-500">User {userId.slice(0, 8)}</span>
      </div>
      <StreakDisplay language="fr" />
    </SectionCard>
  )
}

export default function GamificationPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { activeNetworkId, loading, error } = useGamification(userId)

  if (!userId) {
    return (
      <section className="space-y-4">
        <Topbar />
        <SectionCard>
          <p className="text-sm text-slate-600">Connectez-vous pour accéder à votre progression gamifiée.</p>
        </SectionCard>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <Topbar />

      <TierHero userId={userId} />

      {loading ? <p className="text-sm text-slate-500">Chargement des données gamification...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <ChallengesSection userId={userId} />
          <BadgesGallery userId={userId} />
        </div>

        <div className="space-y-4">
          <Leaderboard networkId={activeNetworkId} userId={userId} />
          <StreakCard userId={userId} />
        </div>
      </div>
    </section>
  )
}
