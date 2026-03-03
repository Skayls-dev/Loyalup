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
      className="relative w-full overflow-hidden rounded-2xl border border-white/70 bg-white/85 text-left shadow-sm shadow-slate-900/5 backdrop-blur"
    >
      <div
        className="h-24 w-full"
        style={{
          background: `linear-gradient(135deg, ${network.primary_color}, ${network.secondary_color || network.primary_color})`,
        }}
      />

      <div className="space-y-2 p-3">
        <p className="text-lg font-semibold text-slate-900">
          {network.emoji} {networkName}
        </p>
        <p className="line-clamp-1 text-xs text-slate-500">{tagline || 'Réseau thématique LoyalUp'}</p>

        <div className="text-xs text-slate-600">
          {network.member_count} commerces · {network.client_count} membres
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded bg-amber-50 px-2 py-1 font-semibold text-amber-700">
            +{Math.round((network.points_multiplier - 1) * 100)}% points
          </span>
          {network.coalition_enabled ? (
            <span className="rounded bg-teal-50 px-2 py-1 font-semibold text-teal-700">Coalition active</span>
          ) : null}
          <span
            className={`rounded px-2 py-1 font-semibold ${
              isMember ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {eligibilityLabel}
          </span>
        </div>
      </div>
    </button>
  )
}
