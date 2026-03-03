import { useMemo, useState } from 'react'
import { useNetworkAnnouncements } from '../../hooks/useNetworkAnnouncements'
import { useNetworks } from '../../hooks/useNetworks'
import { useNetworkDetail } from '../../hooks/useNetworkDetail'
import type { NetworkWithEligibility } from '../../types/networkTypes'
import { NetworkActivityFeed } from './NetworkActivityFeed'
import { NetworkCard } from './NetworkCard'
import { NetworkDetailView } from './NetworkDetailView'
import { EmptyState, PrimaryButton, SecondaryButton, Skeleton } from '../../../../shared/components/client-ui'

export function NetworkDiscovery() {
  const { all, enrolled, eligible, loading, enroll, unenroll, refresh, error } = useNetworks()
  const { unreadCount } = useNetworkAnnouncements()

  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<NetworkWithEligibility | null>(null)
  const selectedDetail = useNetworkDetail(selected?.slug ?? '')

  const eligibleIds = new Set(eligible.map((network) => network.id))
  const enrolledIds = new Set(enrolled.map((item) => item.network.id))

  const filtered = useMemo(() => {
    return all.filter((network) => {
      if (category !== 'all' && network.category !== category) {
        return false
      }

      if (search.trim()) {
        const query = search.trim().toLowerCase()
        const name = (network.name.fr ?? network.name.en ?? network.slug).toLowerCase()
        if (!name.includes(query)) {
          return false
        }
      }

      return true
    })
  }, [all, category, search])

  const featured = filtered.filter((network) => network.is_featured)

  return (
    <section className="space-y-4 rounded-2xl border border-white/70 bg-white/85 p-4 text-slate-900 shadow-sm shadow-slate-900/5 backdrop-blur">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Réseaux</h2>
        <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
          {unreadCount} nouveautés
        </span>
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Mes réseaux</h3>
        {enrolled.length === 0 ? (
          <EmptyState
            title="Aucun réseau rejoint"
            description="Rejoignez votre premier réseau pour débloquer les bonus multi-commerces."
          />
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {enrolled.map((item) => (
              <button
                key={item.network.id}
                type="button"
                onClick={() => setSelected({ ...item.network, is_member: true })}
                className="min-w-[220px] rounded-xl border border-slate-200 bg-white/90 p-3 text-left shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-900">{item.network.emoji} {item.network.name.fr ?? item.network.slug}</p>
                <p className="text-xs text-slate-600">Mes points réseau: {item.total_network_points}</p>
                <p className="text-xs text-slate-500">+{Math.round((item.network.points_multiplier - 1) * 100)}% bonus</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error.message}</p> : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Réseaux mis en avant</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {featured.map((network) => (
            <button
              key={network.id}
              type="button"
              onClick={() => setSelected(network)}
              className="rounded-xl border border-white/70 p-4 text-left shadow-sm shadow-slate-900/5"
              style={{
                background: `linear-gradient(135deg, ${network.primary_color}33, ${network.secondary_color || network.primary_color}33)`,
              }}
            >
              <p className="text-lg font-semibold text-slate-900">{network.emoji} {network.name.fr ?? network.slug}</p>
              <p className="text-xs text-slate-700">{network.tagline?.fr ?? network.tagline?.en ?? 'Réseau sponsorisé'}</p>
              <span className="mt-2 inline-flex rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">Rejoindre</span>
            </button>
          ))}
          {featured.length === 0 ? <p className="text-xs text-slate-500">Aucun réseau mis en avant.</p> : null}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Parcourir tous les réseaux</h3>

        <div className="flex flex-wrap gap-2">
          {[
            ['all', '🌟 Tous'],
            ['cultural', '🌍 Culturel'],
            ['environmental', '🌿 Écologie'],
            ['religious', '☪️ Religieux'],
            ['social', '💜 Social'],
            ['educational', '🎓 Éducation'],
            ['geographic', '📍 Local'],
            ['custom', '✨ Autre'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`rounded-full px-2.5 py-1 text-xs ${category === value ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un réseau"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
        />

        {loading ? (
          <Skeleton className="h-20" />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((network) => (
              <div key={network.id} className="space-y-1">
                <NetworkCard
                  network={network}
                  isMember={enrolledIds.has(network.id)}
                  clientEligible={eligibleIds.has(network.id)}
                  onOpen={setSelected}
                />
                <p className="text-[11px] text-slate-500">{Math.max(1, Math.round(network.member_count * 0.35))} commerces près de vous</p>
                {!enrolledIds.has(network.id) && eligibleIds.has(network.id) ? (
                  <PrimaryButton
                    type="button"
                    onClick={() => {
                      void enroll({ networkId: network.id })
                    }}
                    className="h-9 w-full"
                  >
                    Rejoindre
                  </PrimaryButton>
                ) : enrolledIds.has(network.id) ? (
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      void unenroll(network.id)
                    }}
                    className="h-9 w-full border-rose-200 text-rose-700 hover:bg-rose-50"
                  >
                    Quitter
                  </SecondaryButton>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <NetworkActivityFeed />

      {selected ? (
        <NetworkDetailView
          network={selected}
          members={selectedDetail.members}
          announcements={selectedDetail.announcements}
          onClose={() => setSelected(null)}
          onRefresh={() => {
            void Promise.all([refresh(), selectedDetail.refresh()])
          }}
        />
      ) : null}
    </section>
  )
}
