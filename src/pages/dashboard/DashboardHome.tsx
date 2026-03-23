import { QrCode } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useDashboardStats } from '../../hooks/useDashboardStats'
import { useDashboard } from '../../hooks/useDashboard'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import NotificationBell from '../../components/notifications/NotificationBell'
import { ChallengesList } from '../../components/dashboard/ChallengesList'
import { PointsActivityChart } from '../../components/dashboard/PointsActivityChart'
import { RecentTransactions } from '../../components/dashboard/RecentTransactions'
import { RewardsList } from '../../components/dashboard/RewardsList'
import { TierCard } from '../../components/dashboard/TierCard'
import { UserNetworksList } from '../../components/dashboard/UserNetworksList'

function formatFrenchDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function DashboardHome() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const userId = user?.id ?? ''
  const {
    totalPoints,
    pointsDeltaWeek,
    activeNetworks,
    monthlyTransactions,
    tier,
    progressToNextTier,
    activeNetworkName,
    loading,
  } = useDashboardStats()
  const { networks, tier: tierData } = useDashboard(userId)

  const userName = profile?.nom?.trim() || 'Membre Looyaal'
  const today = formatFrenchDate(new Date())

  const statCards = [
    {
      key: 'points',
      title: 'Points totaux',
      value: totalPoints.toLocaleString('fr-FR'),
      valueClassName: 'bg-gradient-to-r from-primary to-[#8B7FF5] bg-clip-text text-transparent',
      subtitle: `+${pointsDeltaWeek.toLocaleString('fr-FR')} cette semaine`,
      subtitleClassName: 'text-accent-green',
      accentBg: 'bg-primary',
    },
    {
      key: 'networks',
      title: 'Reseaux actifs',
      value: activeNetworks.toString(),
      valueClassName: 'text-dark',
      subtitle: 'sur 17 disponibles',
      subtitleClassName: 'text-gray-600',
      accentBg: 'bg-accent-green',
    },
    {
      key: 'transactions',
      title: 'Transactions',
      value: monthlyTransactions.toLocaleString('fr-FR'),
      valueClassName: 'text-dark',
      subtitle: 'ce mois-ci',
      subtitleClassName: 'text-gray-600',
      accentBg: 'bg-accent-orange',
    },
    {
      key: 'level',
      title: 'Niveau',
      value: tier,
      valueClassName: 'text-[#FFD23F]',
      subtitle: `${progressToNextTier}% vers Platinum`,
      subtitleClassName: 'text-gray-600',
      accentBg: 'bg-[#FFD23F]',
    },
  ]

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-5">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-dark">Bonjour, {userName} 👋</h1>
          <p className="mt-2 font-body text-sm text-gray-600">
            {today} · Reseau actif: <span className="font-medium text-gray-800">{activeNetworkName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {userId ? <NotificationBell userId={userId} /> : null}

          <Button
            variant="primary"
            size="lg"
            className="shadow-primary-glow"
            onClick={() => navigate('/scan')}
          >
            <QrCode className="h-4.5 w-4.5" />
            Scanner un QR
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.key}
            className="group relative overflow-hidden rounded-[16px] border border-gray-200 bg-white p-5 transition duration-300 hover:-translate-y-[2px] hover:shadow-floating"
          >
            <span
              aria-hidden="true"
              className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${card.accentBg} opacity-[0.08]`}
            />

            <p className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">{card.title}</p>
            <p className={`mt-3 font-display text-4xl font-extrabold ${card.valueClassName}`}>
              {loading ? '...' : card.value}
            </p>
            <p className={`mt-2 font-body text-sm ${card.subtitleClassName}`}>{card.subtitle}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <TierCard
          className="xl:col-span-1"
          totalPoints={totalPoints}
          currentTier={tierData.current}
          currentTierEmoji={tierData.current === 'Bronze' ? '🥉' : tierData.current === 'Silver' ? '🥈' : tierData.current === 'Gold' ? '🥇' : '💎'}
          nextTier={tierData.next ?? 'Platinum'}
          currentTierThreshold={tierData.currentThreshold}
          nextTierThreshold={tierData.nextThreshold ?? Math.max(totalPoints + 1, 10_000)}
        />
        <PointsActivityChart userId={userId} className="xl:col-span-2" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <RecentTransactions userId={userId} className="xl:col-span-2" />
        <ChallengesList userId={userId} className="xl:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <UserNetworksList networks={networks} />
        <RewardsList />
      </div>
    </section>
  )
}
