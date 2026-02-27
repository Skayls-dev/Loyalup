import { useEffect, useState } from 'react'
import { getRecentTransactions, type ProviderRecentTransaction } from '../services/providerService'

type RecentTransactionsProps = {
  fournisseur_id: string | null
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)))

  if (minutes < 60) {
    return `Il y a ${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `Il y a ${hours} h`
  }

  const days = Math.floor(hours / 24)
  return `Il y a ${days} j`
}

export function RecentTransactions({ fournisseur_id }: RecentTransactionsProps) {
  const [items, setItems] = useState<ProviderRecentTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      try {
        if (!fournisseur_id) {
          setItems([])
          return
        }

        const rows = await getRecentTransactions(fournisseur_id, 10)
        setItems(rows)
      } finally {
        setLoading(false)
      }
    }

    load().catch(() => null)
  }, [fournisseur_id])

  if (loading) {
    return <div className="h-52 animate-pulse rounded-xl bg-zinc-800/70" />
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
        Aucune transaction récente.
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">Transactions récentes</h3>

      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="pb-2">Client</th>
              <th className="pb-2">Service</th>
              <th className="pb-2">Montant</th>
              <th className="pb-2">Points</th>
              <th className="pb-2">Temps</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-800 text-zinc-300">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold">
                      {item.client.nom.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{item.client.nom}</span>
                  </div>
                </td>
                <td className="py-2">
                  {item.service.emoji} {item.service.nom}
                </td>
                <td className="py-2">{item.montant.toFixed(2)} €</td>
                <td className="py-2 text-emerald-400">+{item.points_credited}</td>
                <td className="py-2 text-zinc-500">{formatRelativeTime(item.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
