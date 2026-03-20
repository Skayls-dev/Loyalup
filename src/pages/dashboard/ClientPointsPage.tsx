import { TrendingUp } from 'lucide-react'
import { PointsActivityChart } from '../../components/dashboard/PointsActivityChart'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { LoyaltyCardList } from '../../modules/loyalty/components/LoyaltyCardList'
import { Badge, PageHeader, SectionCard } from '../../shared/components/client-ui'

export default function ClientPointsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return (
    <section className="space-y-4">
      <PageHeader
        title="Mes points"
        subtitle="Retrouvez vos cartes fidélité, votre total cumulé et la dynamique récente de vos gains."
        rightActions={<Badge variant="primary">Vue fidélité</Badge>}
      />

      {userId ? (
        <PointsActivityChart userId={userId} weeks={10} />
      ) : (
        <SectionCard>
          <p className="text-sm text-slate-600">Connectez-vous pour consulter votre activité points.</p>
        </SectionCard>
      )}

      <SectionCard className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Programmes actifs</h2>
            <p className="text-sm text-slate-500">Suivez vos progressions par marchand et rechargez les données si besoin.</p>
          </div>
        </div>

        <LoyaltyCardList />
      </SectionCard>
    </section>
  )
}
