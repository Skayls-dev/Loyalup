import { Gift, Sparkles } from 'lucide-react'
import { RewardList } from '../../modules/loyalty/components/RewardList'
import { PromoList } from '../../modules/promotions/components/PromoList'
import { Badge, PageHeader, SectionCard } from '../../shared/components/client-ui'

export default function ClientRewardsPage() {
  return (
    <section className="space-y-4">
      <PageHeader
        title="Récompenses"
        subtitle="Consultez les récompenses débloquées et les promotions en cours avant votre prochain achat."
        rightActions={<Badge variant="primary">Offres client</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)]">
        <SectionCard className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Gift className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Catalogue disponible</h2>
              <p className="text-sm text-slate-500">Utilisez vos points chez vos marchands favoris dès qu'une récompense est éligible.</p>
            </div>
          </div>

          <RewardList />
        </SectionCard>

        <SectionCard className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Promotions actives</h2>
              <p className="text-sm text-slate-500">Gardez un œil sur les campagnes en cours pour maximiser vos gains.</p>
            </div>
          </div>

          <PromoList />
        </SectionCard>
      </div>
    </section>
  )
}
