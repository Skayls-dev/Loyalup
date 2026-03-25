import { useNavigate } from 'react-router-dom'
import { MerchantNetworks } from '../../components/merchant/MerchantNetworks'
import { MerchantOffers } from '../../components/merchant/MerchantOffers'
import { MerchantConsumedServicesCard } from '../../components/merchant/MerchantConsumedServicesCard'
import { MerchantConsumedRewardsCard } from '../../components/merchant/MerchantConsumedRewardsCard'
import { MerchantQrShowcase } from '../../components/merchant/MerchantQrShowcase'
import { MerchantRevenueChart } from '../../components/merchant/MerchantRevenueChart'
import { MerchantTransactions } from '../../components/merchant/MerchantTransactions'
import { TopCustomers } from '../../components/merchant/TopCustomers'
import { Button } from '../../components/ui'
import { useMerchantStats } from '../../hooks/useMerchantStats'

export interface MerchantHomeProps {
  merchantId: string
  storeName?: string
  city?: string
  primaryNetwork?: string
}

export function MerchantHome({
  merchantId,
  storeName = 'Kongo Market',
  city = 'Bruxelles',
  primaryNetwork = 'Africa Network',
}: MerchantHomeProps) {
  const navigate = useNavigate()
  const { stats, loading, error } = useMerchantStats(merchantId)

  const cards = [
    {
      key: 'revenue',
      title: 'Chiffre du mois',
      value: `${stats.monthlyRevenue.toLocaleString('fr-FR')} €`,
      valueClassName: 'bg-gradient-to-r from-[#FF6B35] to-[#FF9A6B] bg-clip-text text-transparent',
      subtitle: `${stats.monthlyRevenueGrowthPercent >= 0 ? '+' : ''}${stats.monthlyRevenueGrowthPercent}% vs mois dernier`,
      subtitleClassName: 'text-accent-green',
      accentClassName: 'bg-[#FF6B35]',
    },
    {
      key: 'points',
      title: 'Points distribués',
      value: stats.monthlyPointsDistributed.toLocaleString('fr-FR'),
      valueClassName: 'bg-gradient-to-r from-primary to-[#8B7FF5] bg-clip-text text-transparent',
      subtitle: stats.multiplierLabel,
      subtitleClassName: 'text-gray-600',
      accentClassName: 'bg-primary',
    },
    {
      key: 'customers',
      title: 'Clients fidèles',
      value: stats.loyalCustomers.toLocaleString('fr-FR'),
      valueClassName: 'text-dark',
      subtitle: `+${stats.newCustomersThisMonth.toLocaleString('fr-FR')} nouveaux`,
      subtitleClassName: 'text-accent-green',
      accentClassName: 'bg-accent-green',
    },
    {
      key: 'reputation',
      title: 'Réputation',
      value: stats.ratingCount > 0 ? `${stats.averageRating.toFixed(1)} ★` : 'N/A',
      valueClassName: 'text-dark',
      subtitle: stats.ratingCount > 0
        ? `${stats.ratingCount.toLocaleString('fr-FR')} avis clients`
        : 'Aucun avis pour le moment',
      subtitleClassName: 'text-gray-500',
      accentClassName: 'bg-[#FFD23F]',
    },
  ]

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-5">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-dark">Dashboard Marchand</h1>
          <p className="mt-2 font-body text-sm text-gray-600">
            {storeName} · {city} · {primaryNetwork}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="md"
            className="border border-gray-200 text-gray-700"
            onClick={() => navigate('/merchant/performance')}
          >
            📥 Exporter
          </Button>
          <Button
            size="md"
            className="border-[#FF6B35] bg-[#FF6B35] text-white shadow-[0_8px_26px_rgba(255,107,53,0.35)] hover:brightness-105"
            onClick={() => navigate('/merchant/qr')}
          >
            ⊙ Générer QR code
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.key}
            className="group relative overflow-hidden rounded-[16px] border border-gray-200 bg-white p-5 transition duration-300 hover:-translate-y-[2px]"
          >
            <span className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${card.accentClassName} opacity-[0.08]`} aria-hidden="true" />
            <p className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">{card.title}</p>
            <p className={`mt-3 font-display text-4xl font-extrabold ${card.valueClassName}`}>
              {loading ? '...' : card.value}
            </p>
            <p className={`mt-2 font-body text-sm ${card.subtitleClassName}`}>{card.subtitle}</p>
          </article>
        ))}
      </div>

      <MerchantQrShowcase />

      <MerchantConsumedServicesCard merchantId={merchantId} />

      <MerchantConsumedRewardsCard merchantId={merchantId} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <MerchantRevenueChart merchantId={merchantId} className="xl:col-span-2" />
        <TopCustomers merchantId={merchantId} className="xl:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MerchantTransactions merchantId={merchantId} limit={6} />
        <MerchantNetworks merchantId={merchantId} />
      </div>

      <MerchantOffers merchantId={merchantId} />

      {error ? <p className="font-body text-sm text-rose-600">{error}</p> : null}
    </section>
  )
}
