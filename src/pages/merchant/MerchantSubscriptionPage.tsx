import { Button } from '../../components/ui'
import { useMerchantStats } from '../../hooks/useMerchantStats'
import { useAuth } from '../../modules/auth/hooks/useAuth'

const plans = [
  {
    name: 'Starter',
    price: '9€/mois',
    accent: 'from-gray-100 to-white',
    border: 'border-gray-200',
    text: 'text-gray-900',
    features: ['500 clients max', 'Dashboard standard', 'QR sécurisé'],
  },
  {
    name: 'Premium',
    price: '29€/mois',
    accent: 'from-[#FFF3EE] to-white',
    border: 'border-[#FF6B35]/25',
    text: 'text-[#C44A18]',
    features: ['Clients illimités', 'Analytics avancées', 'Offres & segmentation'],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Sur devis',
    accent: 'from-[#EEF3FF] to-white',
    border: 'border-primary/20',
    text: 'text-primary',
    features: ['White label', 'API & exports complets', 'Accompagnement dédié'],
  },
]

export default function MerchantSubscriptionPage() {
  const { user } = useAuth()
  const merchantId = user?.id ?? ''
  const { stats } = useMerchantStats(merchantId)

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Abonnement</h1>
        <p className="mt-2 font-body text-sm text-gray-600">
          Comparez les plans et évaluez si votre activité mérite un upgrade.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-lg border border-gray-200 bg-white p-5 xl:col-span-1">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Utilisation actuelle</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="font-body text-sm text-gray-600">Clients fidèles</span>
              <strong className="font-display text-lg text-dark">{stats.loyalCustomers}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="font-body text-sm text-gray-600">Points distribués</span>
              <strong className="font-display text-lg text-dark">{stats.monthlyPointsDistributed.toLocaleString('fr-FR')}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="font-body text-sm text-gray-600">Taux de retour</span>
              <strong className="font-display text-lg text-dark">{stats.retentionRate}%</strong>
            </div>
            <div className="rounded-lg border border-primary/15 bg-primary-light px-4 py-3 text-sm text-gray-700">
              Plan recommandé: <span className="font-semibold text-primary">Premium</span>
            </div>
          </div>
        </article>

        <div className="grid grid-cols-1 gap-4 xl:col-span-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-lg border bg-gradient-to-b ${plan.accent} p-5 ${plan.border} ${plan.featured ? 'shadow-card' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className={`font-display text-2xl font-extrabold ${plan.text}`}>{plan.name}</h2>
                  <p className="mt-2 font-body text-sm text-gray-600">{plan.price}</p>
                </div>
                {plan.featured ? (
                  <span className="rounded-full bg-[#FF6B35] px-2.5 py-1 text-[11px] font-semibold text-white">Recommandé</span>
                ) : null}
              </div>

              <ul className="mt-5 space-y-2 text-sm text-gray-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="rounded-md border border-white/70 bg-white/70 px-3 py-2">
                    {feature}
                  </li>
                ))}
              </ul>

              <Button className="mt-5 w-full" variant={plan.featured ? 'primary' : 'ghost'}>
                {plan.featured ? 'Commencer l’essai 14 jours' : 'Choisir ce plan'}
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}