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
  title: 'Boostez vos visites avec Looyaal Premium',
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
    <article className={`overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.10)] ${className}`}>
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
              preload="auto"
              className="aspect-[16/9] w-full object-cover"
            />
          ) : (
            <img
              src={resolvedAd.mediaUrl}
              alt={resolvedAd.title}
              className="aspect-[16/9] w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white/35 via-transparent to-transparent" />
          <p className="absolute left-4 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm">
            {resolvedAd.badge}
          </p>
        </div>
      ) : (
        <p className="px-6 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{resolvedAd.badge}</p>
      )}

      <div className="p-6 pt-4">
        <h2 className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-600 bg-clip-text text-2xl font-bold leading-tight text-transparent">
          {resolvedAd.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{resolvedAd.description}</p>
      </div>

      <div className="px-6 pb-6">
        {normalizedCtaUrl ? (
          <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-sky-50/70 p-3">
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={normalizedCtaUrl} size={78} includeMargin level="M" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Scannez pour</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{resolvedAd.ctaLabel}</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-5 py-2.5 text-sm font-bold text-white transition hover:shadow-[0_8px_28px_rgba(14,165,233,0.30)]"
            onClick={() => {
              console.log('AdBanner CTA clicked')
            }}
          >
            {resolvedAd.ctaLabel}
          </button>
        )}
        <p className="mt-2 text-xs text-slate-500">{resolvedAd.ctaNote}</p>
      </div>

      <div className="px-6 pb-6">
        <div className="mt-1 flex items-center gap-2">
          {Array.from({ length: Math.max(1, pagination?.total ?? 3) }).map((_, index) => {
            const isActive = index === (pagination?.activeIndex ?? 0)
            return <span key={index} className={isActive ? 'h-1.5 w-5 rounded-full bg-sky-500' : 'h-1.5 w-1.5 rounded-full bg-slate-300'} />
          })}
        </div>
      </div>
    </article>
  )
}
