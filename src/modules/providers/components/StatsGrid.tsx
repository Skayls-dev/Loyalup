import { BarChart3, CircleDollarSign, CreditCard, Users } from 'lucide-react'
import type { ProviderStats } from '../services/providerService'
import { StatCard } from './StatCard'

type StatsGridProps = {
  stats: ProviderStats | null
  loading: boolean
}

export function StatsGrid({ stats, loading }: StatsGridProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-zinc-800/70" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="Clients total" value={stats.total_clients} icon={<Users className="h-4 w-4" />} color="teal" />
      <StatCard
        label="Transactions aujourd'hui"
        value={stats.transactions_today}
        icon={<CreditCard className="h-4 w-4" />}
        color="orange"
      />
      <StatCard
        label="Points distribués"
        value={stats.total_points_distributed}
        icon={<BarChart3 className="h-4 w-4" />}
        color="amber"
      />
      <StatCard
        label="Revenus aujourd'hui"
        value={Math.round(stats.revenue_today)}
        icon={<CircleDollarSign className="h-4 w-4" />}
        color="green"
      />
    </div>
  )
}
