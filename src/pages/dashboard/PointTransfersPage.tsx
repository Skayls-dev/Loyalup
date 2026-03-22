import { ArrowLeftRight } from 'lucide-react'
import { MarketplaceView } from '../../modules/gamification/components'
import { Badge, PageHeader, SectionCard } from '../../shared/components/client-ui'

export default function PointTransfersPage() {
  return (
    <section className="space-y-4">
      <PageHeader
        title="Transfert de points"
        subtitle="Deplacez vos points entre marchands appartenant au meme reseau partenaire."
        rightActions={<Badge variant="warn">Beta</Badge>}
      />

      <SectionCard className="flex items-start gap-3 border-amber-100 bg-amber-50/70">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <ArrowLeftRight className="h-4 w-4" />
        </span>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Comment ca marche</h2>
          <p className="text-sm text-slate-600">
            Choisissez un marchand source avec un solde disponible, puis un marchand de destination du meme reseau.
            Les frais et la conversion sont affiches avant confirmation.
          </p>
        </div>
      </SectionCard>

      <MarketplaceView />
    </section>
  )
}
