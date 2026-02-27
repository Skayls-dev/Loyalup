import { memo } from 'react'
import type { ProviderClient } from '../services/providerService'

type ClientListItemProps = {
  client: ProviderClient
  topPoints: number
}

function ClientListItemComponent({ client, topPoints }: ClientListItemProps) {
  const progress = topPoints > 0 ? Math.round((client.solde / topPoints) * 100) : 0

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-100">
              {client.profile.nom.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">{client.profile.nom}</p>
              <p className="truncate text-xs text-zinc-500">{client.profile.email}</p>
            </div>
          </div>

          <p className="mt-2 text-xs text-zinc-500">
            {client.total_visites} visites • Dernière visite:{' '}
            {client.last_visit ? new Date(client.last_visit).toLocaleDateString() : 'N/A'}
          </p>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </div>

        <p className="text-sm font-black text-amber-300">{client.solde} pts</p>
      </div>
    </article>
  )
}

export const ClientListItem = memo(ClientListItemComponent)
