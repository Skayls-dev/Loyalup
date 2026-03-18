import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNetworksList, type NetworkListItem, type NetworkStatus } from '../../hooks/useNetworksList'

type StatusStyle = {
  bg: string
  color: string
  label: string
}

const statusStyles: Record<NetworkStatus, StatusStyle> = {
  active: {
    bg: '#E1F5EE',
    color: '#0F6E56',
    label: 'Actif',
  },
  paused: {
    bg: '#F1F3F9',
    color: 'var(--g600)',
    label: 'En pause',
  },
  draft: {
    bg: '#FAEEDA',
    color: '#633806',
    label: 'Brouillon',
  },
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="font-body text-xs uppercase tracking-[0.13em] text-gray-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-extrabold text-dark">{value}</p>
    </article>
  )
}

function NetworkCard({ network, onClick }: { network: NetworkListItem; onClick: () => void }) {
  const statusStyle = statusStyles[network.status]
  const footerMuted = network.status === 'paused'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-gray-200 bg-white p-4 text-left transition duration-200 hover:-translate-y-[2px] hover:border-violet-300 hover:shadow-[0_12px_26px_rgba(91,79,232,0.12)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ backgroundColor: `${network.primaryColor}22` }}
          aria-hidden="true"
        >
          {network.emoji}
        </span>

        <span
          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
        >
          {statusStyle.label}
        </span>
      </div>

      <div className="mt-3">
        <p className="truncate font-body text-base font-semibold text-dark">{network.name}</p>
        <p className="mt-1 line-clamp-2 min-h-[2.6rem] font-body text-sm text-gray-600">{network.description}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
          x{network.multiplier.toFixed(1)}
        </span>
        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
          {network.merchantCount.toLocaleString('fr-FR')} marchands
        </span>
        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
          {network.memberCount.toLocaleString('fr-FR')} membres
        </span>
      </div>

      <div className={`mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs ${footerMuted ? 'opacity-70' : ''}`}>
        <span className="font-body text-gray-600">{network.dailyPoints.toLocaleString('fr-FR')} pts/jour</span>
        <span className="font-body text-gray-600">{network.retentionPct}% rétention</span>
        <span className="font-body font-semibold text-dark">{network.merchantCount.toLocaleString('fr-FR')} marchands</span>
      </div>
    </button>
  )
}

export default function NetworksListPage() {
  const navigate = useNavigate()
  const { networks, stats, loading, error } = useNetworksList()

  const statCards = useMemo(
    () => [
      { key: 'activeNetworks', label: 'Réseaux actifs', value: stats.activeNetworks.toLocaleString('fr-FR') },
      { key: 'totalMerchants', label: 'Marchands totaux', value: stats.totalMerchants.toLocaleString('fr-FR') },
      { key: 'activeUsers', label: 'Utilisateurs actifs', value: stats.activeUsers.toLocaleString('fr-FR') },
      { key: 'pointsDistributed', label: 'Points distribués', value: stats.pointsDistributed.toLocaleString('fr-FR') },
    ],
    [stats.activeNetworks, stats.activeUsers, stats.pointsDistributed, stats.totalMerchants],
  )

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold text-dark">Réseaux</h1>
        <p className="mt-1 font-body text-sm text-gray-600">Pilotage des réseaux et de leur performance quotidienne.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.key} label={card.label} value={card.value} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {networks.map((network) => (
          <NetworkCard key={network.id} network={network} onClick={() => navigate(`/admin/networks/${network.id}`)} />
        ))}

        <button
          type="button"
          onClick={() => navigate('/admin/networks/new')}
          className="flex min-h-[250px] items-center justify-center rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/25 text-violet-700 transition hover:-translate-y-[2px] hover:border-violet-400 hover:bg-violet-50"
        >
          <span className="font-display text-4xl font-extrabold">+</span>
        </button>
      </div>

      {loading ? <p className="font-body text-sm text-gray-500">Chargement des réseaux...</p> : null}
      {error ? <p className="font-body text-sm text-rose-600">{error}</p> : null}
    </section>
  )
}
