import { useEffect, useRef, useState } from 'react'
import { Expand, RefreshCw } from 'lucide-react'
import { supabase } from '../../shared/lib/supabaseClient'
import { AdBanner, type AdConfig } from '../../modules/providers/components/AdBanner'
import { StatsGrid } from '../../modules/providers/components/StatsGrid'
import { useProviderStats } from '../../modules/providers/hooks/useProviderStats'
import { QRDisplay } from '../../modules/qr/components/QRDisplay'

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

type MerchantQrShowcaseProps = {
  className?: string
}

const fallbackAds: AdConfig[] = [
  {
    badge: 'Publicite',
    title: 'Boostez vos visites avec LoyalUp Premium',
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

export function MerchantQrShowcase({ className = '' }: MerchantQrShowcaseProps) {
  const { stats, loading } = useProviderStats()
  const [ads, setAds] = useState<AdConfig[]>(fallbackAds)
  const [activeAdIndex, setActiveAdIndex] = useState(0)
  const [qrRefreshKey, setQrRefreshKey] = useState(0)
  const showcaseRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const loadAds = async () => {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('scan_screen_ads')
        .select('id, advertiser_name, title, body, cta_label, cta_url, media_type, media_url, poster_url')
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
    if (ads.length <= 1) return

    const timer = window.setInterval(() => {
      setActiveAdIndex((prev) => (prev + 1) % ads.length)
    }, 9000)

    return () => {
      window.clearInterval(timer)
    }
  }, [ads])

  const handleFullscreen = async () => {
    const showcase = showcaseRef.current
    if (!showcase) return

    if (document.fullscreenElement === showcase) {
      await document.exitFullscreen().catch(() => null)
      return
    }

    await showcase.requestFullscreen?.().catch(() => null)
  }

  return (
    <div
      ref={showcaseRef}
      className={`mx-auto grid w-full items-start gap-4 xl:grid-cols-[minmax(320px,40%)_minmax(0,60%)] ${className}`}
    >
      <div className="flex w-full flex-col gap-3">
        <div className="rounded-3xl bg-[#081221] p-3 text-white shadow-[0_24px_60px_rgba(2,8,23,0.28)]">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Affichage caisse</p>
              <p className="mt-1 text-sm text-white/70">Le QR se génère automatiquement à l’ouverture.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQrRefreshKey((prev) => prev + 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
                aria-label="Actualiser le QR"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleFullscreen()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
                aria-label="Plein écran"
              >
                <Expand className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div key={qrRefreshKey}>
            <QRDisplay />
          </div>
        </div>

        <StatsGrid stats={stats} loading={loading} compact />
      </div>

      <div className="min-w-0 w-full">
        <AdBanner ad={ads[activeAdIndex] ?? fallbackAds[0]} pagination={{ activeIndex: activeAdIndex, total: ads.length }} />
      </div>
    </div>
  )
}