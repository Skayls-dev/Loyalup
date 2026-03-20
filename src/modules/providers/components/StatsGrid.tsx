import { BarChart3, CircleDollarSign, CreditCard, Users } from 'lucide-react'
import type { ProviderStats } from '../services/providerService'
import { StatCard } from './StatCard'

type StatsGridProps = {
  stats: ProviderStats | null
  loading: boolean
  compact?: boolean
}

export function StatsGrid({ stats, loading, compact = false }: StatsGridProps) {
  if (compact) {
    if (loading || !stats) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
          ))}
        </div>
      )
    }

    const compactItems = [
      { label: 'STATUT QR', value: 'Actif', color: 'text-slate-900' },
      { label: 'TEMPS RESTANT', value: '02:15', color: 'text-[#00e5a0]' },
      { label: 'POINTS CLIENT', value: `${stats.total_points_distributed.toLocaleString()} pts`, color: 'text-[#d4a017]' },
      { label: 'SCANS AUJOURD\'HUI', value: stats.transactions_today.toLocaleString(), color: 'text-[#3eb8f0]' },
    ]

    return (
      <div className="grid grid-cols-2 gap-2">
        {compactItems.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
    )
  }

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
