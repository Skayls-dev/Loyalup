import { useNavigate } from 'react-router-dom'

export interface UserNetworkListItem {
  id: string
  name: string
  emoji: string
  bgColor: string
  badgeColor: string
  points: number
  merchantCount: number
  multiplier: number
  nextThreshold: number
}

export interface UserNetworksListProps {
  networks: UserNetworkListItem[]
  className?: string
}

function ratioPercent(points: number, nextThreshold: number): number {
  if (nextThreshold <= 0) return 100
  const ratio = (points / nextThreshold) * 100
  return Math.max(0, Math.min(100, ratio))
}

export function UserNetworksList({ networks, className = '' }: UserNetworksListProps) {
  const navigate = useNavigate()

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Mes réseaux actifs</p>
        <span className="font-body text-xs text-gray-500">{networks.length}</span>
      </div>

      <div className="space-y-2">
        {networks.map((network) => {
          const progress = ratioPercent(network.points, network.nextThreshold)

          return (
            <button
              key={network.id}
              type="button"
              onClick={() => navigate(`/dashboard/networks/${network.id}`)}
              className="group w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-left transition-all hover:border-primary/60 hover:bg-primary-light/35"
            >
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg"
                  style={{ backgroundColor: network.bgColor }}
                  aria-hidden="true"
                >
                  {network.emoji}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold text-dark">{network.name}</p>
                  <p className="mt-0.5 font-body text-xs text-gray-600">
                    {network.points.toLocaleString('fr-FR')} pts · {network.merchantCount.toLocaleString('fr-FR')} marchands
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className="inline-flex rounded-full px-2.5 py-1 font-body text-[11px] font-semibold text-white"
                    style={{ backgroundColor: network.badgeColor }}
                  >
                    x{network.multiplier.toFixed(1)} pts
                  </span>
                  <div className="h-[3px] w-20 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            </button>
          )
        })}

        {networks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center font-body text-sm text-gray-500">
            Aucun réseau actif pour le moment.
          </p>
        ) : null}
      </div>
    </section>
  )
}
