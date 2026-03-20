import { Receipt } from 'lucide-react'
import { PointsActivityChart } from '../../components/dashboard/PointsActivityChart'
import { RecentTransactions } from '../../components/dashboard/RecentTransactions'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { TransactionHistory } from '../../modules/loyalty/components/TransactionHistory'
import { Badge, PageHeader, SectionCard } from '../../shared/components/client-ui'

export default function ClientTransactionsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return (
    <section className="space-y-4">
      <PageHeader
        title="Transactions"
        subtitle="Suivez vos passages en caisse récents et le détail des crédits de points associés."
        rightActions={<Badge variant="warn">Temps réel</Badge>}
      />

      {userId ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <RecentTransactions userId={userId} limit={8} />
          <PointsActivityChart userId={userId} weeks={8} />
        </div>
      ) : (
        <SectionCard>
          <p className="text-sm text-slate-600">Connectez-vous pour voir vos transactions.</p>
        </SectionCard>
      )}

      <SectionCard className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Receipt className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Journal détaillé</h2>
            <p className="text-sm text-slate-500">Historique complet des validations, avec rafraîchissement et chargement progressif.</p>
          </div>
        </div>

        <TransactionHistory />
      </SectionCard>
    </section>
  )
}
