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

const primaryButtonClass =
  'h-8 rounded border border-[#0078D4] bg-[#0078D4] px-3 text-xs font-semibold text-white transition hover:bg-[#106ebe] disabled:opacity-60'

const secondaryButtonClass =
  'h-8 rounded border border-[#0078D4] bg-white px-3 text-xs font-semibold text-[#0078D4] transition hover:bg-[#f3f2f1] disabled:opacity-60'

const dangerButtonClass =
  'h-8 rounded border border-[#d13438] bg-white px-3 text-xs font-semibold text-[#d13438] transition hover:bg-[#fdf3f4] disabled:opacity-60'

const warningButtonClass =
  'h-8 rounded border border-[#986f0b] bg-white px-3 text-xs font-semibold text-[#986f0b] transition hover:bg-[#fffbf0] disabled:opacity-60'

const inputClass =
  'h-8 rounded border border-[#d2d0ce] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078D4]'

const sectionCardClass = 'rounded-md border border-[#edebe9] bg-white p-4 shadow-sm'

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
    <section className="space-y-4 text-[#323130]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Réseaux</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAnnouncements((value) => !value)}
            className={secondaryButtonClass}
          >
            Annonces {unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setShowBuilder((value) => !value)}
            className={primaryButtonClass}
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

      <section className={sectionCardClass}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={(event) => setFilterCategory(event.target.value)}
            className={inputClass}
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
            className={inputClass}
          >
            <option value="all">Tous statuts</option>
            <option value="active">Actif</option>
            <option value="draft">Brouillon</option>
            <option value="suspended">Suspendu</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className={inputClass}
          >
            <option value="clients">Tri : clients</option>
            <option value="members">Tri : membres</option>
            <option value="created">Tri : création</option>
            <option value="activity">Tri : activité</option>
          </select>
        </div>

        {networksLoading ? (
          <div className="h-24 animate-pulse rounded-md border border-[#edebe9] bg-[#faf9f8]" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-y border-[#edebe9] bg-[#faf9f8] text-left text-[#605E5C]">
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
                  <tr key={network.id} className="border-t border-[#edebe9] text-[#323130] hover:bg-[#f3f2f1]">
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedNetworkId(network.id)}
                        className="text-left font-medium text-[#323130] hover:text-[#0078D4]"
                      >
                        {network.emoji} {network.name.fr ?? network.name.en ?? network.slug}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-[#605E5C]">{network.category}</td>
                    <td className="px-2 py-2 text-[#605E5C]">{network.member_count}</td>
                    <td className="px-2 py-2 text-[#605E5C]">{network.client_count}</td>
                    <td className="px-2 py-2 text-[#605E5C]">{network.points_multiplier.toFixed(2)}x</td>
                    <td className="px-2 py-2">
                      <StatusBadge isActive={network.is_active} isDraft={network.is_draft} />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => setSelectedNetworkId(network.id)} className={secondaryButtonClass}>
                          Statistiques
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteNetwork(network.id)
                          }}
                          className={dangerButtonClass}
                        >
                          Suspendre
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <p className="px-2 py-4 text-xs text-[#605E5C]">Aucun réseau pour ces filtres.</p> : null}
          </div>
        )}
      </section>

      <section className={sectionCardClass}>
        <h2 className="mb-2 text-[17px] font-semibold">Validations en attente</h2>
        {activeRequests.length === 0 ? (
          <p className="text-xs text-[#605E5C]">Aucune demande en attente.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void Promise.all(activeRequests.map((request) => validateMembership(request.id))).then(refreshRequests)
                }}
                className={primaryButtonClass}
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
                className={dangerButtonClass}
              >
                Tout rejeter
              </button>
            </div>
            {activeRequests.map((request) => (
              <div key={request.id} className="rounded-md border border-[#edebe9] bg-[#faf9f8] p-2 text-xs">
                <p className="font-semibold text-[#323130]">
                  {request.fournisseurs?.nom_commerce ?? 'Commerce'} → {request.networks?.name?.fr ?? request.networks?.slug ?? 'Réseau'}
                </p>
                <p className="text-[#605E5C]">{request.request_message || 'Aucun message'}</p>
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
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void validateMembership(request.id).then(refreshRequests)
                    }}
                    className={primaryButtonClass}
                  >
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void rejectMembership(request.id, requestsReason[request.id]).then(refreshRequests)
                    }}
                    className={dangerButtonClass}
                  >
                    Rejeter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void suspendMembership(request.id, requestsReason[request.id]).then(refreshRequests)
                    }}
                    className={warningButtonClass}
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
        <section className={sectionCardClass}>
          <h2 className="mb-3 text-[17px] font-semibold">Statistiques du réseau — {selectedNetwork.name.fr ?? selectedNetwork.slug}</h2>
          {stats.loading ? (
            <div className="h-24 animate-pulse rounded-md border border-[#edebe9] bg-[#faf9f8]" />
          ) : stats.stats ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2 text-xs text-[#605E5C]">
                <p>Commerces membres : {stats.stats.member_count}</p>
                <p>Clients inscrits : {stats.stats.client_count}</p>
                <p>Bonus distribués : {stats.stats.total_bonus_points_distributed}</p>
                <p>Bonus moyen / transaction : {stats.stats.avg_bonus_per_transaction.toFixed(2)}</p>
              </div>
              <div className="h-56 rounded-md border border-[#edebe9] bg-[#faf9f8] p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.timeline?.clients?.map((item) => ({
                      date: item.date,
                      clients: item.count,
                      members: stats.timeline?.members?.find((member) => member.date === item.date)?.count ?? 0,
                    })) ?? []}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e1dfdd" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip />
                    <Bar dataKey="clients" fill="#0078D4" radius={4} />
                    <Bar dataKey="members" fill="#2b88d8" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#605E5C]">Aucune statistique disponible.</p>
          )}
        </section>
      ) : null}

      <section className={sectionCardClass}>
        <h2 className="mb-3 text-[17px] font-semibold">Gestion des sponsorings</h2>
        <div className="grid gap-2 text-xs">
          {sponsorshipRows.map((network) => (
            <div key={network.id} className="flex items-center justify-between rounded-md border border-[#edebe9] bg-[#faf9f8] px-2 py-2 hover:bg-[#f3f2f1]">
              <span className="text-[#323130]">{network.emoji} {network.name.fr ?? network.slug}</span>
              <span className="text-[#605E5C]">
                {network.is_featured ? 'Mis en avant' : 'Standard'} · {network.client_count} clients
              </span>
            </div>
          ))}
          {sponsorshipRows.length === 0 ? <p className="text-[#605E5C]">Aucun sponsoring actif.</p> : null}
        </div>
      </section>
    </section>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#edebe9] bg-white p-4 shadow-sm">
      <p className="text-xs text-[#605E5C]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#323130]">{value}</p>
    </div>
  )
}

function StatusBadge({ isActive, isDraft }: { isActive: boolean; isDraft: boolean }) {
  if (isDraft) {
    return <span className="rounded border border-[#d2d0ce] bg-[#faf9f8] px-2 py-1 text-[10px] text-[#605E5C]">Brouillon</span>
  }

  if (!isActive) {
    return <span className="rounded border border-[#d13438] bg-[#fdf3f4] px-2 py-1 text-[10px] text-[#d13438]">Suspendu</span>
  }

  return <span className="rounded border border-[#0078D4] bg-[#eff6fc] px-2 py-1 text-[10px] text-[#0078D4]">Actif</span>
}
