import { useMemo, useState } from 'react'
import { useNetworkAnnouncements } from '../../hooks/useNetworkAnnouncements'
import { useNetworkBonus } from '../../hooks/useNetworkBonus'
import { useNetworks } from '../../hooks/useNetworks'

export function NetworkActivityFeed() {
  const { announcements } = useNetworkAnnouncements()
  const { bonusByNetwork } = useNetworkBonus()
  const { enrolled } = useNetworks()
  const [filterNetworkId, setFilterNetworkId] = useState('all')

  const events = useMemo(() => {
    const bonusEvents = bonusByNetwork.map((item) => ({
      id: `bonus-${item.network}`,
      network: item.network,
      text: `✨ Vous avez gagné +${item.bonus_points} pts bonus ${item.network}`,
      createdAt: new Date().toISOString(),
    }))

    const announcementEvents = announcements.map((item) => ({
      id: item.id,
      network: item.title.fr ?? item.title.en ?? 'Réseau',
      text: `${item.emoji ?? '📢'} ${item.title.fr ?? item.title.en}`,
      createdAt: item.published_at,
    }))

    const merged = [...bonusEvents, ...announcementEvents]

    const filtered =
      filterNetworkId === 'all'
        ? merged
        : merged.filter((entry) => entry.id.includes(filterNetworkId) || entry.network.includes(filterNetworkId))

    return filtered.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  }, [announcements, bonusByNetwork, filterNetworkId])

  return (
    <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">Fil d’activité réseau</h3>
        <select
          value={filterNetworkId}
          onChange={(event) => setFilterNetworkId(event.target.value)}
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
        >
          <option value="all">Tous les réseaux</option>
          {enrolled.map((item) => (
            <option key={item.network.id} value={item.network.id}>
              {item.network.name.fr ?? item.network.slug}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {events.map((event) => (
          <div key={event.id} className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300">
            {event.text}
          </div>
        ))}
        {events.length === 0 ? <p className="text-xs text-zinc-500">Aucun événement réseau pour le moment.</p> : null}
      </div>
    </section>
  )
}
