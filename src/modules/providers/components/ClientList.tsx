import { useMemo, useRef } from 'react'
import { useClientList } from '../hooks/useClientList'
import { ClientListItem } from './ClientListItem'

export function ClientList() {
  const { clients, loading, hasMore, loadMore, searchQuery, setSearchQuery, sortBy, setSortBy } = useClientList()
  const listRef = useRef<HTMLDivElement | null>(null)

  const topPoints = useMemo(() => Math.max(0, ...clients.map((client) => client.solde)), [clients])

  const onScroll = async () => {
    const el = listRef.current
    if (!el || loading || !hasMore) {
      return
    }

    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remaining < 100) {
      await loadMore()
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Rechercher un client"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as 'points' | 'visits' | 'last_visit')}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="points">Points</option>
          <option value="visits">Visites</option>
          <option value="last_visit">Dernière visite</option>
        </select>
      </div>

      <p className="text-xs text-zinc-500">{clients.length} clients</p>

      <div
        ref={listRef}
        onScroll={() => {
          onScroll().catch(() => null)
        }}
        className="max-h-[60vh] space-y-2 overflow-y-auto pr-1"
      >
        {clients.map((client) => (
          <ClientListItem key={client.profile.id} client={client} topPoints={topPoints} />
        ))}

        {!loading && clients.length === 0 ? <p className="text-sm text-zinc-400">Aucun client trouvé.</p> : null}
        {loading ? <p className="text-xs text-zinc-500">Chargement...</p> : null}
      </div>
    </section>
  )
}
