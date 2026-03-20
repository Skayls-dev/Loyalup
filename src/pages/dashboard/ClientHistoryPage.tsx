import { History } from 'lucide-react'
import { TransactionHistory } from '../../modules/loyalty/components/TransactionHistory'
import { Badge, PageHeader, SectionCard } from '../../shared/components/client-ui'

export default function ClientHistoryPage() {
  return (
    <section className="space-y-4">
      <PageHeader
        title="Historique"
        subtitle="Retrouvez l'historique complet de votre activité fidélité, regroupé par période."
        rightActions={<Badge variant="neutral">Archive</Badge>}
      />

      <SectionCard className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <History className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Toutes les opérations</h2>
            <p className="text-sm text-slate-500">Parcourez vos achats validés, du plus récent au plus ancien.</p>
          </div>
        </div>

        <TransactionHistory />
      </SectionCard>
    </section>
  )
}
