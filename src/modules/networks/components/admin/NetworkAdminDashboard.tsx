import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  deleteNetwork,
  getPendingMembershipRequests,
  getPlatformNetworkOverview,
  rejectMembership,
  suspendMembership,
  validateMembership,
} from '../../services/networkService'
import { useNetworkAnnouncements } from '../../hooks/useNetworkAnnouncements'
import { useNetworks } from '../../hooks/useNetworks'
import { useNetworkStats } from '../../hooks/useNetworkStats'
import type { Network } from '../../types/networkTypes'
import { NetworkBuilder } from './NetworkBuilder'
import { AnnouncementManager } from './AnnouncementManager'

export function NetworkAdminDashboard() {
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft' | 'suspended'>('all')
  const [sortBy, setSortBy] = useState<'clients' | 'members' | 'created' | 'activity'>('clients')
  const [requestsReason, setRequestsReason] = useState<Record<string, string>>({})

  const { all: publicNetworks, loading: networksLoading } = useNetworks()
  const { announcements, unreadCount, refresh: refreshAnnouncements } = useNetworkAnnouncements()

  const [requests, setRequests] = useState<Array<{
    id: string
    network_id: string
    fournisseur_id: string
    request_message: string | null
    created_at: string
    status: string
    networks: { slug: string; name: Record<string, string> | null } | null
    fournisseurs: { nom_commerce: string } | null
  }>>([])

  const [overviewNetworks, setOverviewNetworks] = useState<Network[]>([])

  useEffect(() => {
    void getPendingMembershipRequests().then(setRequests).catch(() => setRequests([]))
    void getPlatformNetworkOverview().then(setOverviewNetworks).catch(() => setOverviewNetworks(publicNetworks))
  }, [publicNetworks])

  const selectedNetwork = useMemo(() => {
    return (overviewNetworks.length > 0 ? overviewNetworks : publicNetworks).find((item) => item.id === selectedNetworkId) ?? null
  }, [overviewNetworks, publicNetworks, selectedNetworkId])

  const stats = useNetworkStats(selectedNetwork?.id ?? '')

  const rows = useMemo(() => {
    const source = overviewNetworks.length > 0 ? overviewNetworks : publicNetworks

    let filtered = source

    if (filterCategory !== 'all') {
      filtered = filtered.filter((network) => network.category === filterCategory)
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((network) => {
        if (filterStatus === 'active') {
          return network.is_active && !network.is_draft
        }

        if (filterStatus === 'draft') {
          return network.is_draft
        }

        return !network.is_active
      })
    }

    return [...filtered].sort((left, right) => {
      if (sortBy === 'clients') {
        return right.client_count - left.client_count
      }

      if (sortBy === 'members') {
        return right.member_count - left.member_count
      }

      if (sortBy === 'activity') {
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    })
  }, [filterCategory, filterStatus, overviewNetworks, publicNetworks, sortBy])

  const totalEnrollments = rows.reduce((sum, network) => sum + network.client_count, 0)
  const totalMemberships = rows.reduce((sum, network) => sum + network.member_count, 0)
  const totalActive = rows.filter((network) => network.is_active && !network.is_draft).length
  const totalDraft = rows.filter((network) => network.is_draft).length
  const totalSuspended = rows.filter((network) => !network.is_active).length

  const sponsorshipRows = rows.filter((network) => network.is_featured || network.is_active).slice(0, 8)

  const handleDeleteNetwork = async (networkId: string) => {
    await deleteNetwork(networkId)
    const refreshed = await getPlatformNetworkOverview()
    setOverviewNetworks(refreshed)
  }

  const refreshRequests = async () => {
    const refreshed = await getPendingMembershipRequests()
    setRequests(refreshed)
  }

  const activeRequests = requests.filter((request) => request.status === 'pending')

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900/85 p-4 text-zinc-100 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Réseaux</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAnnouncements((value) => !value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs"
          >
            Annonces {unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setShowBuilder((value) => !value)}
            className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700"
          >
            Créer un réseau
          </button>
        </div>
      </header>

      {showBuilder ? (
        <NetworkBuilder
          onSaved={async () => {
            setShowBuilder(false)
            setOverviewNetworks(await getPlatformNetworkOverview())
          }}
        />
      ) : null}

      {showAnnouncements ? <AnnouncementManager announcements={announcements} onChanged={() => void refreshAnnouncements()} /> : null}

      <section className="grid gap-3 md:grid-cols-5">
        <KpiCard label="Réseaux actifs" value={String(totalActive)} />
        <KpiCard label="Réseaux brouillons" value={String(totalDraft)} />
        <KpiCard label="Réseaux suspendus" value={String(totalSuspended)} />
        <KpiCard label="Inscriptions clients" value={String(totalEnrollments)} />
        <KpiCard label="Adhésions commerçants" value={String(totalMemberships)} />
      </section>

      <section className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={(event) => setFilterCategory(event.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          >
            <option value="all">Toutes catégories</option>
            {Array.from(new Set(rows.map((network) => network.category))).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          >
            <option value="all">Tous statuts</option>
            <option value="active">Actif</option>
            <option value="draft">Brouillon</option>
            <option value="suspended">Suspendu</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          >
            <option value="clients">Tri : clients</option>
            <option value="members">Tri : membres</option>
            <option value="created">Tri : création</option>
            <option value="activity">Tri : activité</option>
          </select>
        </div>

        {networksLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-zinc-800/70" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-400">
                  <th className="px-2 py-2">Réseau</th>
                  <th className="px-2 py-2">Catégorie</th>
                  <th className="px-2 py-2">Membres</th>
                  <th className="px-2 py-2">Clients</th>
                  <th className="px-2 py-2">Multiplicateur</th>
                  <th className="px-2 py-2">Statut</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((network) => (
                  <tr key={network.id} className="border-t border-zinc-800">
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedNetworkId(network.id)}
                        className="text-left text-zinc-100 hover:text-indigo-300"
                      >
                        {network.emoji} {network.name.fr ?? network.name.en ?? network.slug}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-zinc-300">{network.category}</td>
                    <td className="px-2 py-2 text-zinc-300">{network.member_count}</td>
                    <td className="px-2 py-2 text-zinc-300">{network.client_count}</td>
                    <td className="px-2 py-2 text-zinc-300">{network.points_multiplier.toFixed(2)}x</td>
                    <td className="px-2 py-2">
                      <StatusBadge isActive={network.is_active} isDraft={network.is_draft} />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => setSelectedNetworkId(network.id)} className="rounded bg-zinc-800 px-2 py-1">
                          Statistiques
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteNetwork(network.id)
                          }}
                          className="rounded bg-red-900/50 px-2 py-1 text-red-200"
                        >
                          Suspendre
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <p className="px-2 py-4 text-xs text-zinc-400">Aucun réseau pour ces filtres.</p> : null}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
        <h2 className="mb-2 text-sm font-semibold">Validations en attente</h2>
        {activeRequests.length === 0 ? (
          <p className="text-xs text-zinc-400">Aucune demande en attente.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void Promise.all(activeRequests.map((request) => validateMembership(request.id))).then(refreshRequests)
                }}
                className="rounded bg-emerald-500 px-2 py-1 text-xs font-semibold text-zinc-950"
              >
                Tout approuver
              </button>
              <button
                type="button"
                onClick={() => {
                  void Promise.all(
                    activeRequests.map((request) => rejectMembership(request.id, requestsReason[request.id] ?? undefined)),
                  ).then(refreshRequests)
                }}
                className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-200"
              >
                Tout rejeter
              </button>
            </div>
            {activeRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-zinc-800 p-2 text-xs">
                <p className="font-semibold text-zinc-100">
                  {request.fournisseurs?.nom_commerce ?? 'Commerce'} → {request.networks?.name?.fr ?? request.networks?.slug ?? 'Réseau'}
                </p>
                <p className="text-zinc-400">{request.request_message || 'Aucun message'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={requestsReason[request.id] ?? ''}
                    onChange={(event) =>
                      setRequestsReason((prev) => ({
                        ...prev,
                        [request.id]: event.target.value,
                      }))
                    }
                    placeholder="Motif"
                    className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void validateMembership(request.id).then(refreshRequests)
                    }}
                    className="rounded bg-emerald-500 px-2 py-1 text-xs font-semibold text-zinc-950"
                  >
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void rejectMembership(request.id, requestsReason[request.id]).then(refreshRequests)
                    }}
                    className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-200"
                  >
                    Rejeter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void suspendMembership(request.id, requestsReason[request.id]).then(refreshRequests)
                    }}
                    className="rounded bg-amber-900/50 px-2 py-1 text-xs text-amber-200"
                  >
                    Suspendre
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedNetwork ? (
        <section className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
          <h2 className="mb-3 text-sm font-semibold">Statistiques du réseau — {selectedNetwork.name.fr ?? selectedNetwork.slug}</h2>
          {stats.loading ? (
            <div className="h-24 animate-pulse rounded-lg bg-zinc-800/70" />
          ) : stats.stats ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2 text-xs text-zinc-300">
                <p>Commerces membres : {stats.stats.member_count}</p>
                <p>Clients inscrits : {stats.stats.client_count}</p>
                <p>Bonus distribués : {stats.stats.total_bonus_points_distributed}</p>
                <p>Bonus moyen / transaction : {stats.stats.avg_bonus_per_transaction.toFixed(2)}</p>
              </div>
              <div className="h-56 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.timeline?.clients?.map((item) => ({
                      date: item.date,
                      clients: item.count,
                      members: stats.timeline?.members?.find((member) => member.date === item.date)?.count ?? 0,
                    })) ?? []}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip />
                    <Bar dataKey="clients" fill="#4f46e5" radius={4} />
                    <Bar dataKey="members" fill="#14b8a6" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">Aucune statistique disponible.</p>
          )}
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
        <h2 className="mb-3 text-sm font-semibold">Gestion des sponsorings</h2>
        <div className="grid gap-2 text-xs">
          {sponsorshipRows.map((network) => (
            <div key={network.id} className="flex items-center justify-between rounded border border-zinc-800 px-2 py-1">
              <span className="text-zinc-200">{network.emoji} {network.name.fr ?? network.slug}</span>
              <span className="text-zinc-400">
                {network.is_featured ? 'Mis en avant' : 'Standard'} · {network.client_count} clients
              </span>
            </div>
          ))}
          {sponsorshipRows.length === 0 ? <p className="text-zinc-400">Aucun sponsoring actif.</p> : null}
        </div>
      </section>
    </section>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  )
}

function StatusBadge({ isActive, isDraft }: { isActive: boolean; isDraft: boolean }) {
  if (isDraft) {
    return <span className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300">Brouillon</span>
  }

  if (!isActive) {
    return <span className="rounded bg-red-900/50 px-2 py-1 text-[10px] text-red-200">Suspendu</span>
  }

  return <span className="rounded bg-emerald-900/50 px-2 py-1 text-[10px] text-emerald-200">Actif</span>
}
