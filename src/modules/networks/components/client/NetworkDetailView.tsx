import { useMemo, useState } from 'react'
import { enrollInNetwork, unenrollFromNetwork } from '../../services/networkService'
import type { NetworkAnnouncement, NetworkMember, NetworkWithEligibility } from '../../types/networkTypes'
import { NetworkLeaderboard } from './NetworkLeaderboard'
import { NetworkMembersMap } from './NetworkMembersMap'
import { PrimaryButton, SecondaryButton } from '../../../../shared/components/client-ui'

type NetworkDetailViewProps = {
  network: NetworkWithEligibility
  members: NetworkMember[]
  announcements: NetworkAnnouncement[]
  onClose: () => void
  onRefresh: () => void
}

type DetailTab = 'about' | 'members' | 'announcements' | 'leaderboard'

export function NetworkDetailView({ network, members, announcements, onClose, onRefresh }: NetworkDetailViewProps) {
  const [tab, setTab] = useState<DetailTab>('about')
  const [showEnrollSheet, setShowEnrollSheet] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const networkName = network.name.fr ?? network.name.en ?? network.slug

  const sortedAnnouncements = useMemo(
    () => [...announcements].sort((left, right) => Number(right.is_pinned) - Number(left.is_pinned)),
    [announcements],
  )

  const availableTabs = useMemo(
    () => [
      { value: 'about', label: 'À propos' },
      { value: 'members', label: 'Commerces' },
      { value: 'announcements', label: 'Annonces' },
      ...(network.show_leaderboard !== false ? [{ value: 'leaderboard', label: 'Classement' }] : []),
    ] as Array<{ value: DetailTab; label: string }>,
    [network.show_leaderboard],
  )

  const handleEnroll = async () => {
    try {
      setLoadingAction(true)
      setActionError(null)
      await enrollInNetwork(network.id)
      setShowEnrollSheet(false)
      onRefresh()
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Impossible de rejoindre ce réseau')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleLeave = async () => {
    try {
      setLoadingAction(true)
      setActionError(null)
      await unenrollFromNetwork(network.id)
      onRefresh()
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Impossible de quitter ce réseau')
    } finally {
      setLoadingAction(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/20 p-4 text-slate-900 backdrop-blur-sm">
      <section className="mx-auto w-full max-w-5xl space-y-4">
        <header
          className="relative overflow-hidden rounded-2xl border border-white/70 p-5 shadow-sm shadow-slate-900/10"
          style={{
            background: `linear-gradient(130deg, ${network.primary_color}, ${network.secondary_color || network.primary_color})`,
          }}
        >
          <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded bg-white/70 px-2 py-1 text-xs text-slate-700">
            Fermer
          </button>

          <p className="text-2xl font-semibold text-white">
            {network.emoji} {networkName}
          </p>
          <p className="text-sm text-white/90">
            {network.member_count} commerces · {network.client_count} membres · +
            {Math.round((network.points_multiplier - 1) * 100)}% points
          </p>

          <div className="mt-3 flex gap-2">
            <SecondaryButton
              type="button"
              onClick={() => setShowEnrollSheet(true)}
              disabled={loadingAction}
              className="h-9 border-white/80 bg-white/85 text-slate-800 hover:bg-white"
            >
              {network.is_member ? 'Gérer adhésion' : 'Rejoindre'}
            </SecondaryButton>
          </div>
        </header>

        <nav className="grid gap-1 rounded-xl border border-white/70 bg-white/85 p-1 shadow-sm shadow-slate-900/5" style={{ gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))` }}>
          {availableTabs.map((tabItem) => (
            <TabButton key={tabItem.value} tab={tab} value={tabItem.value} label={tabItem.label} onClick={setTab} />
          ))}
        </nav>

        {tab === 'about' ? (
          <section className="space-y-2 rounded-xl border border-white/70 bg-white/85 p-4 text-sm shadow-sm shadow-slate-900/5">
            <p>{network.description?.fr ?? network.description?.en ?? 'Description non disponible.'}</p>
            <p className="text-slate-600">
              Bonus réseau: chaque transaction chez un membre applique un multiplicateur {network.points_multiplier.toFixed(2)}x.
            </p>
            {network.coalition_enabled ? (
              <p className="text-slate-600">
                Coalition active : transferts inter-commerçants activés (taux {network.transfer_rate.toFixed(2)}).
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === 'members' ? (
          <section className="space-y-2 rounded-xl border border-white/70 bg-white/85 p-4 text-sm shadow-sm shadow-slate-900/5">
            {network.show_member_map !== false ? <NetworkMembersMap members={members} /> : null}
            {members.length === 0 ? (
              <p className="text-slate-500">Aucun commerce membre pour le moment.</p>
            ) : (
              members.map((member) => (
                <div key={member.fournisseur_id} className="rounded-lg border border-slate-200 bg-white p-2">
                  <p className="font-semibold">{member.provider_name}</p>
                  <p className="text-xs text-slate-500">{member.category ?? 'Commerce'} · {member.city ?? 'Ville inconnue'}</p>
                  <button type="button" className="mt-1 rounded bg-indigo-100 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                    Scanner ici
                  </button>
                </div>
              ))
            )}
          </section>
        ) : null}

        {tab === 'announcements' ? (
          <section className="space-y-2 rounded-xl border border-white/70 bg-white/85 p-4 text-sm shadow-sm shadow-slate-900/5">
            {sortedAnnouncements.map((announcement) => (
              <article key={announcement.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="font-semibold">
                  {announcement.emoji ?? '📢'} {announcement.title.fr ?? announcement.title.en}
                  {announcement.is_pinned ? <span className="ml-2 rounded bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">Épinglé</span> : null}
                </p>
                <p className="text-xs text-slate-500">{announcement.content.fr ?? announcement.content.en}</p>
              </article>
            ))}
            {sortedAnnouncements.length === 0 ? <p className="text-slate-500">Aucune annonce.</p> : null}
          </section>
        ) : null}

        {tab === 'leaderboard' ? (
          <NetworkLeaderboard network_id={network.id} />
        ) : null}
      </section>

      {showEnrollSheet ? (
        <div className="fixed inset-x-0 bottom-0 rounded-t-2xl border border-white/70 bg-white/95 p-4 text-slate-900 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-sm font-semibold">{networkName}</p>
          <p className="text-xs text-slate-500">Bonus bienvenue: {network.welcome_bonus_points} pts</p>

          <div className="mt-3 flex gap-2">
            {!network.is_member ? (
              <PrimaryButton
                type="button"
                onClick={() => {
                  void handleEnroll()
                }}
                disabled={loadingAction}
                className="h-9"
              >
                Rejoindre gratuitement
              </PrimaryButton>
            ) : (
              <SecondaryButton
                type="button"
                onClick={() => {
                  void handleLeave()
                }}
                disabled={loadingAction}
                className="h-9 border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                Quitter le réseau
              </SecondaryButton>
            )}
            <SecondaryButton type="button" onClick={() => setShowEnrollSheet(false)} className="h-9">
              Fermer
            </SecondaryButton>
          </div>
          {actionError ? <p className="mt-2 text-xs text-rose-700">{actionError}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function TabButton({
  tab,
  value,
  label,
  onClick,
}: {
  tab: DetailTab
  value: DetailTab
  label: string
  onClick: (value: DetailTab) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${tab === value ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
    >
      {label}
    </button>
  )
}
