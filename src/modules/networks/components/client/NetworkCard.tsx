import type { NetworkWithEligibility } from '../../types/networkTypes'

type NetworkCardProps = {
  network: NetworkWithEligibility
  isMember: boolean
  clientEligible: boolean
  onOpen: (network: NetworkWithEligibility) => void
}

export function NetworkCard({ network, isMember, clientEligible, onOpen }: NetworkCardProps) {
  const networkName = network.name.fr ?? network.name.en ?? network.slug
  const tagline = network.tagline?.fr ?? network.tagline?.en ?? ''
  const eligibilityLabel = isMember
    ? 'Membre ✓'
    : clientEligible
      ? 'Rejoindre'
      : network.client_access === 'invite'
        ? 'Invitation requise'
        : network.client_access === 'level_required'
          ? `Niveau ${network.min_level_required} requis`
          : 'Indisponible'

  return (
    <button
      type="button"
      onClick={() => onOpen(network)}
      className="relative w-full overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 text-left shadow-sm"
    >
      <div
        className="h-24 w-full"
        style={{
          background: `linear-gradient(135deg, ${network.primary_color}, ${network.secondary_color || network.primary_color})`,
        }}
      />

      <div className="space-y-2 p-3">
        <p className="text-lg font-semibold text-zinc-100">
          {network.emoji} {networkName}
        </p>
        <p className="line-clamp-1 text-xs text-zinc-400">{tagline || 'Réseau thématique LoyalUp'}</p>

        <div className="text-xs text-zinc-300">
          {network.member_count} commerces · {network.client_count} membres
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded bg-amber-500/15 px-2 py-1 font-semibold text-amber-300">
            +{Math.round((network.points_multiplier - 1) * 100)}% points
          </span>
          {network.coalition_enabled ? (
            <span className="rounded bg-teal-500/15 px-2 py-1 font-semibold text-teal-300">Coalition active</span>
          ) : null}
          <span
            className={`rounded px-2 py-1 font-semibold ${
              isMember ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {eligibilityLabel}
          </span>
        </div>
      </div>
    </button>
  )
}
