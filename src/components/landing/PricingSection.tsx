import { useNavigate } from 'react-router-dom'
import { Button } from '../ui'

interface PricingPlan {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  highlighted: boolean
}

const plans: PricingPlan[] = [
  {
    name: 'Starter',
    price: 'Gratuit',
    period: '',
    description: 'Pour démarrer avec la fidélité sans engagement.',
    features: [
      'Jusqu\'à 50 clients actifs',
      '1 réseau de fidelite',
      'QR code dynamique',
      'Tableau de bord basique',
      'Support e-mail',
    ],
    cta: 'Commencer gratuitement',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '29€',
    period: '/ mois',
    description: 'Pour les marchands qui veulent croître rapidement.',
    features: [
      'Clients illimités',
      '5 réseaux de fidélité',
      'Campagnes et offres flash',
      'Code manuel 6 chiffres',
      'Espace pub en caisse',
      'Analytics avancés',
      'Support prioritaire',
    ],
    cta: 'Démarrer en Pro',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '89€',
    period: '/ mois',
    description: 'Pour les coalitions et enseignes multi-sites.',
    features: [
      'Tout le plan Pro',
      'Réseaux illimités',
      'API & webhooks',
      'Programmes de parrainage',
      'Gestion multi-marchands',
      'SLA 99,9%',
      'Onboarding dédié',
    ],
    cta: 'Contacter l\'équipe',
    highlighted: false,
  },
]

export function PricingSection() {
  const navigate = useNavigate()

  return (
    <section className="bg-gray-50 py-14 sm:py-16 lg:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tarifs</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-dark sm:text-4xl">Simple, transparent, sans surprise</h2>
          <p className="mt-3 font-body text-base leading-relaxed text-gray-600">
            Choisissez l&apos;offre adaptée à votre volume. Changez de plan à tout moment.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex flex-col rounded-xl border p-6 transition-all duration-300 ${
                plan.highlighted
                  ? 'border-primary bg-dark text-white shadow-primary-glow scale-[1.03]'
                  : 'border-gray-200 bg-white text-dark hover:-translate-y-1 hover:shadow-card'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 font-body text-xs font-semibold text-white shadow-primary-glow">
                  Plus populaire
                </span>
              )}

              <div>
                <p className={`font-body text-sm font-semibold uppercase tracking-[0.14em] ${plan.highlighted ? 'text-primary-light' : 'text-primary'}`}>
                  {plan.name}
                </p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="font-display text-4xl font-extrabold leading-none">{plan.price}</span>
                  {plan.period && (
                    <span className={`mb-1 font-body text-sm ${plan.highlighted ? 'text-gray-400' : 'text-gray-500'}`}>{plan.period}</span>
                  )}
                </div>
                <p className={`mt-2 font-body text-sm leading-relaxed ${plan.highlighted ? 'text-gray-400' : 'text-gray-500'}`}>
                  {plan.description}
                </p>
              </div>

              <ul className="mt-6 flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 font-body text-sm">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${plan.highlighted ? 'bg-primary/30 text-primary-light' : 'bg-primary-light text-primary'}`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span className={plan.highlighted ? 'text-gray-200' : 'text-gray-700'}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  size="md"
                  variant={plan.highlighted ? 'primary' : 'ghost'}
                  className="w-full"
                  onClick={() => navigate(plan.name === 'Business' ? '/contact' : '/signup')}
                >
                  {plan.cta}
                </Button>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center font-body text-xs text-gray-500">
          Tous les plans incluent l&apos;essai gratuit 14 jours · Pas de carte requise · Annulation à tout moment
        </p>
      </div>
    </section>
  )
}
