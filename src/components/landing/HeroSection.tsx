import { useNavigate } from 'react-router-dom'
import { Badge, Button, FloatingCard, ProgressBar } from '../ui'

interface NetworkPill {
  label: string
}

const networkPills: NetworkPill[] = [
  { label: 'Africa Network' },
  { label: 'Brussels Local' },
  { label: 'Eco-Reseau' },
]

const avatars = ['AK', 'BL', 'CM', 'DN']

export function HeroSection() {
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden bg-gray-50 py-12 sm:py-16 lg:py-20">
      <div className="absolute inset-x-0 top-0 -z-0 h-56 bg-gradient-to-b from-primary-light/70 to-transparent" aria-hidden="true" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
        <div>
          <Badge variant="default" dot className="px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]">
            Fidelite multi-reseaux · Nouvelle generation
          </Badge>

          <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-dark sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
            Activez la fidelite sur
            <span className="block bg-gradient-to-r from-primary to-[#8B7FF5] bg-clip-text text-transparent">
              tous vos reseaux
            </span>
          </h1>

          <p className="mt-4 max-w-xl font-body text-base leading-relaxed text-gray-600 sm:text-lg">
            LoyalUp connecte vos marchands, vos clients et vos coalitions dans une experience de points fluide, visible et rentable.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button size="lg" variant="primary" onClick={() => navigate('/signup')}>
              Demarrer gratuitement
            </Button>
            <Button size="lg" variant="ghost" onClick={() => navigate('/login')}>
              Voir la demo
            </Button>
          </div>

          <div className="mt-7 flex items-center gap-4">
            <div className="flex -space-x-3">
              {avatars.map((avatar, index) => (
                <div
                  key={avatar}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-primary-light to-white font-body text-[11px] font-semibold text-primary shadow-floating"
                  style={{ zIndex: avatars.length - index }}
                >
                  {avatar}
                </div>
              ))}
            </div>
            <p className="font-body text-sm text-gray-600">
              <span className="font-semibold text-dark">2 400 utilisateurs actifs</span> ce mois-ci
            </p>
          </div>
        </div>

        <div className="relative">
          <article className="relative rounded-xl border border-gray-200 bg-white p-6 shadow-card sm:p-7">
            <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-400">Dashboard fidelite</p>

            <div className="mt-5">
              <p className="font-display text-5xl font-extrabold leading-none text-dark">8 450</p>
              <p className="mt-2 font-body text-sm font-medium text-accent-green">+320 pts cette semaine</p>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-body text-xs uppercase tracking-[0.12em] text-gray-500">Progression vers Gold</p>
                <p className="font-body text-xs font-medium text-gray-700">68%</p>
              </div>
              <ProgressBar value={68} color="primary" />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {networkPills.map((pill) => (
                <Badge key={pill.label} variant="info" className="px-3 py-1.5 text-[11px] font-medium">
                  {pill.label}
                </Badge>
              ))}
            </div>
          </article>

          <FloatingCard
            title="+150 pts"
            subtitle="Epicerie Kongo Market"
            className="absolute -bottom-6 left-4 w-[240px]"
            style={{ animationDelay: '180ms' }}
            icon={<span className="font-body text-sm font-semibold">+150</span>}
          />

          <div
            className="absolute -right-2 -top-4 inline-flex animate-float-card items-center rounded-full border border-primary/20 bg-primary-light px-3 py-2 text-xs font-body font-medium text-primary shadow-floating"
            style={{ animationDelay: '520ms' }}
          >
            Niveau Gold atteint !
          </div>
        </div>
      </div>
    </section>
  )
}
