interface FeatureItem {
  title: string
  description: string
  icon: string
  iconBg: string
}

const features: FeatureItem[] = [
  {
    title: 'Réseaux thématiques',
    description: 'Créez des coalitions locales et sectorielles pour mutualiser vos offres et fidéliser en réseau.',
    icon: 'RN',
    iconBg: '#EBE9FF',
  },
  {
    title: 'Points instantanés',
    description: 'Attribuez des points en temps réel via scan QR pour renforcer la satisfaction et la récurrence.',
    icon: 'PI',
    iconBg: '#E1F5EE',
  },
  {
    title: 'Gamification avancée',
    description: 'Activez badges, niveaux et défis afin de transformer chaque visite en progression motivante.',
    icon: 'GA',
    iconBg: '#FAECE7',
  },
  {
    title: 'Tableau de bord marchand',
    description: 'Suivez les performances, campagnes et comportements clients depuis une interface claire.',
    icon: 'TB',
    iconBg: '#FAEEDA',
  },
  {
    title: 'Données agrégées',
    description: 'Visualisez des indicateurs consolidés pour piloter vos décisions marketing et réseau.',
    icon: 'DA',
    iconBg: '#EAF3DE',
  },
  {
    title: 'API & Intégrations',
    description: 'Connectez Looyaal à vos outils métiers grâce à des endpoints robustes et documentés.',
    icon: 'API',
    iconBg: '#FBEAF0',
  },
]

export function FeaturesSection() {
  return (
    <section className="bg-white py-14 sm:py-16 lg:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-primary">Fonctionnalités</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-dark sm:text-4xl">Tout ce qu&apos;il faut pour animer votre fidélité</h2>
          <p className="mt-3 font-body text-base leading-relaxed text-gray-600">
            Une suite complète pour engager vos clients, coordonner vos marchands partenaires et accélérer la croissance de vos réseaux.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="group relative overflow-hidden rounded-lg border border-gray-200 bg-[#F8F9FC] p-5 transition-all duration-300 hover:-translate-y-[3px] hover:border-primary/70 hover:bg-white hover:shadow-card after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:border after:border-primary after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-100"
            >
              <div
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl font-body text-xs font-semibold text-gray-700"
                style={{ backgroundColor: feature.iconBg }}
                aria-hidden="true"
              >
                {feature.icon}
              </div>

              <h3 className="font-display text-xl font-bold text-dark">{feature.title}</h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-gray-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
