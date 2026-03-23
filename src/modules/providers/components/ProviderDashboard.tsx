import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../shared/lib/supabaseClient'
import { QRDisplay } from '../../qr/components/QRDisplay'
import { PromoManager } from '../../promotions/components/PromoManager'
import { ProviderAnalytics } from '../../analytics/components/ProviderAnalytics'
import { ConsentSettings } from '../../../shared/components/ConsentSettings'
import { DataExportButton } from '../../../shared/components/DataExportButton'
import { useProviderStats } from '../hooks/useProviderStats'
import { ClientList } from './ClientList'
import { ConsumedServicesCard } from './ConsumedServicesCard'
import { ConsumedRewardsCard } from './ConsumedRewardsCard'
import { RecentTransactions } from './RecentTransactions'
import { RewardRuleManager } from './RewardRuleManager'
import { ServiceManager } from './ServiceManager'
import { StatsGrid } from './StatsGrid'
import { WhiteLabelConfig } from './WhiteLabelConfig'
import { DeveloperPortal } from './DeveloperPortal'
import { AdBanner, type AdConfig } from './AdBanner'
import { ProviderNetworkHub } from '../../networks/components/provider'

type ProviderScanAd = {
  id: string
  advertiser_name: string | null
  title: string
  body: string
  cta_label: string | null
  cta_url: string | null
  media_type: 'image' | 'video' | null
  media_url: string | null
  poster_url: string | null
}

const fallbackAds: AdConfig[] = [
  {
    badge: 'Publicite',
    title: 'Boostez vos visites avec Looyaal Premium',
    description: 'Activez des campagnes intelligentes et transformez chaque passage en retour client mesurable.',
    ctaLabel: 'Activer Premium',
    ctaNote: 'Sans engagement · Essai 14 jours gratuit',
    mediaType: 'image',
    mediaUrl: '/ads/premium-boost.svg',
  },
  {
    badge: 'Campagne flash',
    title: 'Activez vos campagnes du week-end en 2 minutes',
    description: 'Diffusez une offre limitee et poussez plus de scans sur les creneaux calmes.',
    ctaLabel: 'Creer une campagne',
    ctaNote: 'Rotation QR · Ciblage local intelligent',
    mediaType: 'image',
    mediaUrl: '/ads/flash-campaign.svg',
  },
  {
    badge: 'Coalition',
    title: 'Fidelisez mieux avec vos reseaux partenaires',
    description: 'Mettez en avant vos avantages coalition et augmentez les visites croisees entre commerces membres.',
    ctaLabel: 'Voir les reseaux',
    ctaNote: 'Activation immediate · Statistiques live',
    mediaType: 'image',
    mediaUrl: '/ads/coalition-network.svg',
  },
]

function mapScanAdToBannerConfig(ad: ProviderScanAd): AdConfig {
  return {
    badge: ad.advertiser_name ?? 'Publicite',
    title: ad.title,
    description: ad.body,
    ctaLabel: ad.cta_label?.trim() || 'En savoir plus',
    ctaUrl: ad.cta_url ?? undefined,
    ctaNote: ad.cta_url ? 'Redirection disponible · Rotation QR' : 'Rotation QR active',
    mediaType: ad.media_type ?? undefined,
    mediaUrl: ad.media_url ?? undefined,
    posterUrl: ad.poster_url ?? undefined,
  }
}

type DashboardTab =
  | 'qr'
  | 'dashboard'
  | 'clients'
  | 'promotions'
  | 'networks'
  | 'settings'
  | 'white-label'
  | 'developers'

const tabs: Array<{ key: DashboardTab; label: string }> = [
  { key: 'qr', label: 'QR Code' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clients', label: 'Clients' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'networks', label: 'Réseaux' },
  { key: 'settings', label: 'Paramètres' },
  { key: 'white-label', label: 'White Label' },
  { key: 'developers', label: 'Developer Portal' },
]

export function ProviderDashboard() {
  const [searchParams] = useSearchParams()
  const tabFromQuery = searchParams.get('tab') as DashboardTab | null
  const activeTab: DashboardTab = tabFromQuery && tabs.some((item) => item.key === tabFromQuery) ? tabFromQuery : 'qr'

  const { stats, loading, fournisseurId, lastUpdated } = useProviderStats()
  const [ads, setAds] = useState<AdConfig[]>(fallbackAds)
  const [activeAdIndex, setActiveAdIndex] = useState(0)

  useEffect(() => {
    const loadAds = async () => {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('scan_screen_ads')
        .select('id, title, body, cta_label, cta_url, media_type, media_url, poster_url')
        .eq('active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error || !data || data.length === 0) {
        setAds(fallbackAds)
        setActiveAdIndex(0)
        return
      }

      setAds((data as ProviderScanAd[]).map(mapScanAdToBannerConfig))
      setActiveAdIndex(0)
    }

    void loadAds()
  }, [])

  useEffect(() => {
    if (ads.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveAdIndex((prev) => (prev + 1) % ads.length)
    }, 9000)

    return () => {
      window.clearInterval(timer)
    }
  }, [ads])

  const dashboardContent = useMemo(() => {
    if (activeTab === 'qr') {
      return (
        <div className="mx-auto grid w-full max-w-[1360px] items-start gap-4 xl:grid-cols-[minmax(320px,40%)_minmax(0,60%)]">
          <div className="flex w-full flex-col gap-3">
            <QRDisplay />
            <StatsGrid stats={stats} loading={loading} compact />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08]"
                onClick={() => {
                  console.log('Refresh QR requested')
                }}
              >
                🔄 Actualiser QR
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08]"
                onClick={() => {
                  console.log('QR history requested')
                }}
              >
                📋 Historique
              </button>
            </div>
          </div>

          <div className="min-w-0 w-full">
            <AdBanner ad={ads[activeAdIndex] ?? fallbackAds[0]} pagination={{ activeIndex: activeAdIndex, total: ads.length }} />
          </div>
        </div>
      )
    }

    if (activeTab === 'dashboard') {
      return (
        <div className="space-y-4">
          <StatsGrid stats={stats} loading={loading} />
          <ProviderAnalytics />
          <ConsumedServicesCard fournisseur_id={fournisseurId} />
          <ConsumedRewardsCard fournisseur_id={fournisseurId} />
          <RecentTransactions fournisseur_id={fournisseurId} />
          <p className="text-right text-xs text-zinc-500">
            Dernière mise à jour: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '-'}
          </p>
        </div>
      )
    }

    if (activeTab === 'clients') {
      return <ClientList />
    }

    if (activeTab === 'promotions') {
      return <PromoManager />
    }

    if (activeTab === 'networks') {
      return <ProviderNetworkHub />
    }

    if (activeTab === 'white-label') {
      return <WhiteLabelConfig />
    }

    if (activeTab === 'developers') {
      return <DeveloperPortal />
    }

    return (
      <div className="space-y-4">
        <ServiceManager />
        <RewardRuleManager />
        <ConsentSettings locale="fr" />
        <DataExportButton />
      </div>
    )
  }, [activeTab, fournisseurId, lastUpdated, loading, stats])

  return (
    <section className="w-full space-y-4">
      {dashboardContent}
    </section>
  )
}
