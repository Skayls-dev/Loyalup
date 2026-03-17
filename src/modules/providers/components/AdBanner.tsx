import { QRCodeSVG } from 'qrcode.react'

export type AdConfig = {
  badge?: string
  title: string
  description: string
  ctaLabel: string
  ctaUrl?: string
  ctaNote?: string
  mediaType?: 'image' | 'video'
  mediaUrl?: string
  posterUrl?: string
}

type AdBannerProps = {
  className?: string
  ad?: AdConfig
  pagination?: {
    activeIndex: number
    total: number
  }
}

type ResolvedAdConfig = AdConfig & {
  badge: string
  ctaNote: string
}

const defaultAd: ResolvedAdConfig = {
  badge: 'Publicite',
  title: 'Boostez vos visites avec LoyalUp Premium',
  description: 'Activez des campagnes intelligentes et transformez chaque passage en retour client mesurable.',
  ctaLabel: 'Activer Premium',
  ctaNote: 'Sans engagement · Essai 14 jours gratuit',
  mediaType: 'image',
  mediaUrl: '/ads/premium-boost.svg',
}

export function AdBanner({ className = '', ad, pagination }: AdBannerProps) {
  const resolvedAd: ResolvedAdConfig = {
    ...defaultAd,
    ...ad,
    badge: ad?.badge ?? defaultAd.badge,
    ctaNote: ad?.ctaNote ?? defaultAd.ctaNote,
    ctaUrl: ad?.ctaUrl ?? defaultAd.ctaUrl,
    mediaType: ad?.mediaType ?? defaultAd.mediaType,
    mediaUrl: ad?.mediaUrl ?? defaultAd.mediaUrl,
    posterUrl: ad?.posterUrl ?? defaultAd.posterUrl,
  }
  const normalizedCtaUrl = resolvedAd.ctaUrl
    ? /^(https?:)?\/\//i.test(resolvedAd.ctaUrl)
      ? resolvedAd.ctaUrl
      : `https://${resolvedAd.ctaUrl}`
    : null

  return (
    <article className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-[#060d1a] text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${className}`}>
      {resolvedAd.mediaUrl ? (
        <div className="relative w-full">
          {resolvedAd.mediaType === 'video' ? (
            <video
              src={resolvedAd.mediaUrl}
              poster={resolvedAd.posterUrl}
              autoPlay
              muted
              loop
              playsInline
              className="aspect-[16/9] w-full object-cover"
            />
          ) : (
            <img
              src={resolvedAd.mediaUrl}
              alt={resolvedAd.title}
              className="aspect-[16/9] w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060d1a]/80 via-transparent to-transparent" />
          <p className="absolute left-4 top-3 text-[10px] uppercase tracking-[0.22em] text-white/50">{resolvedAd.badge}</p>
        </div>
      ) : (
        <p className="px-6 pt-5 text-[10px] uppercase tracking-[0.22em] text-white/40">{resolvedAd.badge}</p>
      )}

      <div className="p-6 pt-4">
        <h2 className="bg-gradient-to-r from-white via-white to-[#3eb8f0] bg-clip-text text-2xl font-bold leading-tight text-transparent">
          {resolvedAd.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">{resolvedAd.description}</p>
      </div>

      <div className="px-6 pb-6">
        {normalizedCtaUrl ? (
          <div className="inline-flex items-center gap-3 rounded-xl border border-white/[0.12] bg-white/[0.03] p-3">
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={normalizedCtaUrl} size={78} includeMargin level="M" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Scannez pour</p>
              <p className="mt-1 text-sm font-semibold text-white">{resolvedAd.ctaLabel}</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-[#3eb8f0] to-[#5b9ef7] px-5 py-2.5 text-sm font-bold text-[#040d1a] transition hover:shadow-[0_8px_28px_rgba(62,184,240,0.35)]"
            onClick={() => {
              console.log('AdBanner CTA clicked')
            }}
          >
            {resolvedAd.ctaLabel}
          </button>
        )}
        <p className="mt-2 text-xs text-white/45">{resolvedAd.ctaNote}</p>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <div className="mt-4 flex items-center gap-2">
          {Array.from({ length: Math.max(1, pagination?.total ?? 3) }).map((_, index) => {
            const isActive = index === (pagination?.activeIndex ?? 0)
            return (
              <span
                key={index}
                className={isActive ? 'h-1.5 w-5 rounded-full bg-[#3eb8f0]' : 'h-1.5 w-1.5 rounded-full bg-white/25'}
              />
            )
          })}
        </div>
      </div>
    </article>
  )
}
