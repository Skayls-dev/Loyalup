export interface AfricaNetworkItem {
  flag: string
  name: string
  description: string
  status: string
  statusColor: string
}

export interface AfricaNetworkSectionProps {
  networks?: AfricaNetworkItem[]
}

const defaultNetworks: AfricaNetworkItem[] = [
  {
    flag: '🌐',
    name: 'Global Commerce',
    description: 'Un socle commun pour connecter commerces de proximite et enseignes multi-sites.',
    status: 'Actif',
    statusColor: '#00C9A7',
  },
  {
    flag: '🏙️',
    name: 'City Coalition',
    description: 'Activation rapide pour les marchands locaux avec campagnes partagées.',
    status: 'Expansion',
    statusColor: '#FFD23F',
  },
  {
    flag: '🧩',
    name: 'Retail Union',
    description: 'Programme interoperable pour cumuler points et avantages entre enseignes.',
    status: 'Pilote',
    statusColor: '#8B7FF5',
  },
  {
    flag: '🌍',
    name: 'Cross-Border',
    description: 'Mode international pour servir clients et marchands sans barriere géographique.',
    status: 'Strategique',
    statusColor: '#FF6B35',
  },
]

export function AfricaNetworkSection({ networks = defaultNetworks }: AfricaNetworkSectionProps) {
  return (
    <section className="relative overflow-hidden bg-dark py-14 sm:py-16 lg:py-20 before:pointer-events-none before:absolute before:inset-x-0 before:top-[-220px] before:mx-auto before:h-[520px] before:w-[520px] before:rounded-full before:bg-[radial-gradient(circle,rgba(139,127,245,0.32)_0%,rgba(139,127,245,0.12)_35%,rgba(10,10,15,0)_70%)] before:content-['']">
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7FF5]">Réseau ouvert</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">Looyaal fonctionne pour tous les marchands et tous les clients</h2>
          <p className="mt-3 font-body text-base leading-relaxed text-[#9098B3]">
            Déployez votre fidélité où vous voulez: commerce local, réseau multi-villes ou activité internationale.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {networks.map((network) => (
            <article
              key={`${network.name}-${network.status}`}
              className="flex min-h-[210px] flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#8B7FF5]/60 hover:bg-[#8B7FF5]/15"
            >
              <span className="text-3xl" aria-hidden="true">
                {network.flag}
              </span>
              <h3 className="mt-3 font-display text-xl font-bold text-white">{network.name}</h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-[#AEB5CF]">{network.description}</p>

              <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-body font-medium text-white">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: network.statusColor }} aria-hidden="true" />
                {network.status}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
