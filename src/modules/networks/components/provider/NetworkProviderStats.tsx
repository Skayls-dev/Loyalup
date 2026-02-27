import { useMemo } from 'react'
import { useNetworkStats } from '../../hooks/useNetworkStats'

type NetworkProviderStatsProps = {
  network_id: string
}

export function NetworkProviderStats({ network_id }: NetworkProviderStatsProps) {
  const { stats, loading } = useNetworkStats(network_id)

  const metrics = useMemo(() => {
    if (!stats) {
      return null
    }

    return {
      pointsDistributed: stats.total_bonus_points_distributed,
      newClientsAcquired: Math.max(0, stats.client_growth_last_30d),
      retentionImprovement: Math.min(100, Math.round(stats.avg_bonus_per_transaction * 2)),
      revenueAttributed: stats.total_transactions_with_bonus * 12,
      coalitionTransfersTopClients: stats.top_providers_by_clients.slice(0, 5),
    }
  }, [stats])

  if (loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-zinc-800/70" />
  }

  if (!metrics) {
    return <p className="text-xs text-zinc-400">Aucune statistique réseau disponible.</p>
  }

  return (
    <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3 text-sm">
      <h3 className="text-sm font-semibold">Statistiques commerçant du réseau</h3>
      <div className="grid gap-2 md:grid-cols-2">
        <Metric label="Points distribués" value={`${metrics.pointsDistributed.toLocaleString()} pts`} />
        <Metric label="Nouveaux clients" value={String(metrics.newClientsAcquired)} />
        <Metric label="Rétention" value={`${metrics.retentionImprovement}%`} />
        <Metric label="Revenu attribué" value={`${metrics.revenueAttributed.toLocaleString()} €`} />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-zinc-300">Top clients via transferts coalition</p>
        <div className="space-y-1">
          {metrics.coalitionTransfersTopClients.map((provider) => (
            <div key={provider.fournisseur_id} className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-300">
              {provider.provider_name} · {provider.address ?? 'Adresse indisponible'}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  )
}
