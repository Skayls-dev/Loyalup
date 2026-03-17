type Feature = {
  emoji: string
  title: string
  description: string
}

type Metric = {
  value: string
  label: string
}

export type AdConfig = {
  badge?: string
  title: string
  description: string
  ctaLabel: string
  ctaNote?: string
  metrics?: Metric[]
  features?: Feature[]
}

type AdBannerProps = {
  className?: string
  ad?: AdConfig
  pagination?: {
    activeIndex: number
    total: number
  }
}

const defaultAd: Required<AdConfig> = {
  badge: 'Publicite',
  title: 'Boostez vos visites avec LoyalUp Premium',
  description: 'Activez des campagnes intelligentes et transformez chaque passage en retour client mesurable.',
  ctaLabel: 'Activer Premium',
  ctaNote: 'Sans engagement · Essai 14 jours gratuit',
  metrics: [
    { value: '+34%', label: 'retours' },
    { value: '12 480 pts', label: 'cumules' },
    { value: '78%', label: 'fidelite' },
  ],
  features: [
    { emoji: '🎯', title: 'Ciblage local', description: 'Segmentez vos clients selon les habitudes de visite.' },
    { emoji: '⚡', title: 'Activation rapide', description: 'Lancez une offre en moins de deux minutes.' },
    { emoji: '📈', title: 'Analyse en direct', description: 'Visualisez les performances pendant la campagne.' },
    { emoji: '🤝', title: 'Fidelisation', description: 'Recompensez les retours avec des incentives progressifs.' },
  ],
}

export function AdBanner({ className = '', ad, pagination }: AdBannerProps) {
  const resolvedAd: Required<AdConfig> = {
    ...defaultAd,
    ...ad,
    metrics: ad?.metrics ?? defaultAd.metrics,
    features: ad?.features ?? defaultAd.features,
  }

  return (
    <article className={`rounded-2xl border border-white/[0.08] bg-[#060d1a] p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">{resolvedAd.badge}</p>

      <h2 className="mt-3 bg-gradient-to-r from-white via-white to-[#3eb8f0] bg-clip-text text-3xl font-bold leading-tight text-transparent">
        {resolvedAd.title}
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/55">{resolvedAd.description}</p>

      <div className="mt-5 rounded-xl border border-[#3eb8f0]/[0.16] bg-[#3eb8f0]/[0.08] p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {resolvedAd.metrics.map((metric) => (
            <div key={`${metric.value}-${metric.label}`} className="rounded-lg border border-white/[0.09] bg-[#040d1a]/70 p-3">
              <p className="text-lg font-semibold text-white">{metric.value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-white/55">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {resolvedAd.features.map((feature) => (
          <div key={feature.title} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="text-sm font-semibold text-white">
              <span className="mr-2">{feature.emoji}</span>
              {feature.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/55">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-[#3eb8f0] to-[#5b9ef7] px-5 py-2.5 text-sm font-bold text-[#040d1a] transition hover:shadow-[0_8px_28px_rgba(62,184,240,0.35)]"
          onClick={() => {
            console.log('AdBanner CTA clicked')
          }}
        >
          {resolvedAd.ctaLabel}
        </button>
        <p className="mt-2 text-xs text-white/45">{resolvedAd.ctaNote}</p>
      </div>

      <div className="mt-5 flex items-center gap-2">
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
    </article>
  )
}
