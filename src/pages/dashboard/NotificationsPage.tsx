import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useToast } from '../../shared/hooks/useToast'
import { supabase } from '../../shared/lib/supabaseClient'
import { PageHeader, SecondaryButton, SectionCard, SwitchRow } from '../../shared/components/client-ui'

export type NotificationFilter = 'all' | 'points' | 'defis' | 'niveaux' | 'reseau'

type NotificationItem = {
  id: string
  userId: string
  type: string
  data: Record<string, unknown>
  createdAt: string
  readAt: string | null
}

type NotificationCounters = Record<NotificationFilter, number>

type NotificationsListProps = {
  userId: string
  filter: NotificationFilter
}

type NotificationPrefsProps = {
  userId: string
}

type NotificationSummaryProps = {
  userId: string
}

function formatRelativeDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date inconnue'

  const diffMs = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return 'À l\'instant'
  if (diffMs < hour) return `Il y a ${Math.max(1, Math.floor(diffMs / minute))} min`
  if (diffMs < day) return `Il y a ${Math.max(1, Math.floor(diffMs / hour))} h`

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })
}

function extractMessage(row: NotificationItem): string {
  const explicit = row.data.message
  if (typeof explicit === 'string' && explicit.trim()) return explicit

  if (row.type === 'tier_upgrade') {
    const newTier = typeof row.data.new_tier_name === 'string' ? row.data.new_tier_name : 'niveau supérieur'
    return `Nouveau niveau atteint: ${newTier}`
  }

  if (row.type === 'badge_unlock') {
    return 'Nouveau badge débloqué'
  }

  if (row.type.includes('challenge')) {
    return 'Défi mis à jour'
  }

  if (row.type.includes('network')) {
    return 'Mise à jour réseau'
  }

  if (row.type.includes('points')) {
    return 'Points mis à jour'
  }

  return 'Nouvelle notification'
}

function mapTypeToFilter(type: string): NotificationFilter {
  if (type.includes('challenge') || type.includes('defi') || type.includes('défi')) return 'defis'
  if (type.includes('tier') || type.includes('level') || type.includes('niveau')) return 'niveaux'
  if (type.includes('network') || type.includes('reseau') || type.includes('réseau')) return 'reseau'
  if (type.includes('point') || type.includes('xp') || type.includes('reward')) return 'points'
  return 'all'
}

function iconForType(type: string): string {
  const filter = mapTypeToFilter(type)
  if (filter === 'points') return '💰'
  if (filter === 'defis') return '🎯'
  if (filter === 'niveaux') return '🏆'
  if (filter === 'reseau') return '🌐'
  return '🔔'
}

function useNotifications(userId: string) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    if (!userId) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('notifications')
      .select('id, user_id, type, data, created_at, read_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    type Row = {
      id: string
      user_id: string
      type: string
      data: Record<string, unknown> | null
      created_at: string
      read_at: string | null
    }

    const next: NotificationItem[] = ((data ?? []) as Row[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      data: row.data ?? {},
      createdAt: row.created_at,
      readAt: row.read_at,
    }))

    setItems(next)
    setLoading(false)
  }

  useEffect(() => {
    void refetch()
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-list:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => void refetch(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return { items, loading, error, refetch }
}

export function useUnreadCount(userId: string) {
  const [unreadCount, setUnreadCount] = useState(0)

  const refetchUnread = async () => {
    if (!userId) {
      setUnreadCount(0)
      return
    }

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)

    setUnreadCount(count ?? 0)
  }

  useEffect(() => {
    void refetchUnread()
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-unread:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => void refetchUnread(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return { unreadCount, refetchUnread }
}

function buildCounters(items: NotificationItem[]): NotificationCounters {
  const counters: NotificationCounters = {
    all: items.length,
    points: 0,
    defis: 0,
    niveaux: 0,
    reseau: 0,
  }

  for (const item of items) {
    const filter = mapTypeToFilter(item.type)
    if (filter !== 'all') {
      counters[filter] += 1
    }
  }

  return counters
}

function ToastPreview() {
  const { toasts, show } = useToast()

  return (
    <SectionCard className="space-y-3 border-indigo-200/80 bg-indigo-50/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Dev only</p>
          <h2 className="text-sm font-semibold text-slate-900">ToastPreview</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => show('Points crédités avec succès', 'success')}>
            Success
          </SecondaryButton>
          <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => show('Nouveau défi disponible', 'info')}>
            Info
          </SecondaryButton>
          <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => show('Erreur de synchronisation', 'error')}>
            Error
          </SecondaryButton>
        </div>
      </div>

      {toasts.length ? (
        <div className="space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                toast.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : toast.type === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-sky-200 bg-sky-50 text-sky-700'
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Aucun toast actif</p>
      )}
    </SectionCard>
  )
}

function NotificationsList({ userId, filter }: NotificationsListProps) {
  const { items, loading, error } = useNotifications(userId)

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((item) => mapTypeToFilter(item.type) === filter)
  }, [filter, items])

  return (
    <SectionCard className="space-y-3">
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          Aucune notification dans ce filtre.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const unread = item.readAt === null
            return (
              <li
                key={item.id}
                className={`rounded-xl border px-3 py-3 transition ${
                  unread ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      <span className="mr-2" aria-hidden="true">{iconForType(item.type)}</span>
                      {extractMessage(item)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatRelativeDate(item.createdAt)}</p>
                  </div>
                  {unread ? <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" aria-hidden="true" /> : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

function NotificationPrefs({ userId }: NotificationPrefsProps) {
  const storageKey = `notifications:prefs:${userId}`
  const [prefs, setPrefs] = useState({
    points: true,
    defis: true,
    niveaux: true,
    reseau: true,
  })

  useEffect(() => {
    if (!userId) return
    const raw = localStorage.getItem(storageKey)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as Partial<typeof prefs>
      setPrefs((prev) => ({ ...prev, ...parsed }))
    } catch {
      // Ignore invalid persisted settings
    }
  }, [storageKey, userId])

  useEffect(() => {
    if (!userId) return
    localStorage.setItem(storageKey, JSON.stringify(prefs))
  }, [prefs, storageKey, userId])

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <SectionCard>
      <h3 className="text-sm font-semibold text-slate-900">Préférences de notification</h3>
      <div className="mt-2">
        <SwitchRow label="Points" description="Crédits, bonus, expiration" checked={prefs.points} onToggle={() => toggle('points')} />
        <SwitchRow label="Défis" description="Progression et complétion" checked={prefs.defis} onToggle={() => toggle('defis')} />
        <SwitchRow label="Niveaux" description="Évolution et paliers" checked={prefs.niveaux} onToggle={() => toggle('niveaux')} />
        <SwitchRow label="Réseaux" description="Invitations et actualités" checked={prefs.reseau} onToggle={() => toggle('reseau')} />
      </div>
    </SectionCard>
  )
}

function NotificationSummary({ userId }: NotificationSummaryProps) {
  const { items } = useNotifications(userId)
  const { unreadCount } = useUnreadCount(userId)
  const counters = useMemo(() => buildCounters(items), [items])

  return (
    <SectionCard className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Résumé</h3>
        <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
          Badge sidebar: {unreadCount}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-slate-600">Total</span>
          <strong className="font-semibold text-slate-900">{counters.all}</strong>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-slate-600">Non lues</span>
          <strong className="font-semibold text-indigo-700">{unreadCount}</strong>
        </div>
      </div>
    </SectionCard>
  )
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all')
  const { items, refetch } = useNotifications(userId)
  const { unreadCount, refetchUnread } = useUnreadCount(userId)

  const counters = useMemo(() => buildCounters(items), [items])

  const filterConfig: Array<{ key: NotificationFilter; label: string }> = [
    { key: 'all', label: 'Tout' },
    { key: 'points', label: 'Points' },
    { key: 'defis', label: 'Défis' },
    { key: 'niveaux', label: 'Niveaux' },
    { key: 'reseau', label: 'Réseaux' },
  ]

  const markAllRead = async () => {
    if (!userId) return
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)

    await Promise.all([refetch(), refetchUnread()])
  }

  if (!userId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Notifications" subtitle="Connectez-vous pour consulter vos alertes" />
        <SectionCard>
          <p className="text-sm text-slate-600">Aucun utilisateur connecté.</p>
        </SectionCard>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {import.meta.env.DEV ? <ToastPreview /> : null}

      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} non lues`}
        rightActions={
          <>
            <SecondaryButton type="button" onClick={() => void markAllRead()}>✓ Tout marquer lu</SecondaryButton>
            <SecondaryButton type="button">⚙ Préférences</SecondaryButton>
          </>
        }
      />

      <SectionCard className="p-3">
        <div className="flex flex-wrap gap-2">
          {filterConfig.map((filter) => {
            const active = activeFilter === filter.key
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{filter.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                  {counters[filter.key]}
                </span>
              </button>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <NotificationsList userId={userId} filter={activeFilter} />

        <div className="space-y-4">
          <NotificationPrefs userId={userId} />
          <NotificationSummary userId={userId} />
        </div>
      </div>
    </section>
  )
}
