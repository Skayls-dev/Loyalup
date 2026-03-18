import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabaseClient'

type NotificationRecord = {
  id: string
  user_id: string
  type: string
  title: string | null
  subtitle: string | null
  tag: string | null
  points: number | null
  data: Record<string, unknown>
  created_at: string
  read_at: string | null
}

type NotificationsResponse = {
  items: NotificationRecord[]
  loading: boolean
  error: string | null
  unreadCount: number
  markAsReadLocally: (id: string) => void
}

type TypeStyle = {
  icon: string
  iconBg: string
  tagClass: string
  label: string
}

type NotificationsListProps = {
  userId: string
  filter: string
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  points: {
    icon: '💰',
    iconBg: '#EBE9FF',
    tagClass: 'bg-violet-50 text-violet-700 border-violet-200',
    label: 'Points',
  },
  challenge: {
    icon: '🎯',
    iconBg: '#EAF3DE',
    tagClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'Défi',
  },
  tier_upgrade: {
    icon: '🏆',
    iconBg: '#FAEEDA',
    tagClass: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Niveau',
  },
  badge: {
    icon: '🏅',
    iconBg: '#FBEAF0',
    tagClass: 'bg-pink-50 text-pink-700 border-pink-200',
    label: 'Badge',
  },
  network: {
    icon: '🌐',
    iconBg: '#FFF3EE',
    tagClass: 'bg-orange-50 text-orange-700 border-orange-200',
    label: 'Réseau',
  },
  streak: {
    icon: '🔥',
    iconBg: '#FFF3EE',
    tagClass: 'bg-orange-50 text-orange-700 border-orange-200',
    label: 'Streak',
  },
}

const DEFAULT_STYLE: TypeStyle = {
  icon: '🔔',
  iconBg: '#F1F5F9',
  tagClass: 'bg-slate-50 text-slate-700 border-slate-200',
  label: 'Info',
}

function normalizeType(rawType: string): string {
  if (rawType.includes('challenge')) return 'challenge'
  if (rawType.includes('tier')) return 'tier_upgrade'
  if (rawType.includes('badge')) return 'badge'
  if (rawType.includes('network') || rawType.includes('reseau') || rawType.includes('réseau')) return 'network'
  if (rawType.includes('streak')) return 'streak'
  if (rawType.includes('point') || rawType.includes('xp') || rawType.includes('reward')) return 'points'
  return rawType
}

function getTypeStyle(type: string): TypeStyle {
  return TYPE_STYLES[normalizeType(type)] ?? DEFAULT_STYLE
}

function buildTitle(row: NotificationRecord): string {
  if (row.title && row.title.trim().length > 0) return row.title

  const t = normalizeType(row.type)
  if (t === 'points') return 'Points mis à jour'
  if (t === 'challenge') return 'Défi mis à jour'
  if (t === 'tier_upgrade') return 'Niveau amélioré'
  if (t === 'badge') return 'Badge débloqué'
  if (t === 'network') return 'Actualité réseau'
  if (t === 'streak') return 'Streak mis à jour'
  return 'Notification'
}

function buildSubtitle(row: NotificationRecord): string {
  if (row.subtitle && row.subtitle.trim().length > 0) return row.subtitle

  const message = row.data.message
  if (typeof message === 'string' && message.trim().length > 0) return message

  const t = normalizeType(row.type)
  if (t === 'points') return 'Consultez vos transactions pour plus de détails.'
  if (t === 'challenge') return 'Votre progression a évolué.'
  if (t === 'tier_upgrade') return 'Nouveau palier atteint dans votre progression.'
  if (t === 'badge') return 'Une nouvelle récompense est disponible.'
  if (t === 'network') return 'Mise à jour sur vos réseaux partenaires.'
  if (t === 'streak') return 'Votre série quotidienne a changé.'
  return 'Nouvelle activité sur votre compte.'
}

function extractPoints(row: NotificationRecord): number | null {
  if (typeof row.points === 'number' && Number.isFinite(row.points)) return row.points

  const keys = ['points', 'reward_points', 'xp_points', 'delta_points']
  for (const key of keys) {
    const value = row.data[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value)
    }
  }

  return null
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatGroupLabel(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Date inconnue'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (sameDay(current, today)) return "Aujourd'hui"
  if (sameDay(current, yesterday)) return 'Hier'

  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(date)
}

function routeForType(type: string): string {
  const normalized = normalizeType(type)
  if (normalized === 'points') return '/dashboard/transactions'
  if (normalized === 'challenge') return '/dashboard/gamification'
  if (normalized === 'tier_upgrade') return '/dashboard/gamification'
  if (normalized === 'badge') return '/dashboard/gamification#badges'
  if (normalized === 'network') return '/dashboard/networks'
  if (normalized === 'streak') return '/dashboard/gamification'
  return '/dashboard'
}

function mapRow(raw: Record<string, unknown>): NotificationRecord {
  return {
    id: String(raw.id ?? ''),
    user_id: String(raw.user_id ?? ''),
    type: String(raw.type ?? 'info'),
    title: typeof raw.title === 'string' ? raw.title : null,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : null,
    tag: typeof raw.tag === 'string' ? raw.tag : null,
    points: typeof raw.points === 'number' ? raw.points : null,
    data: (raw.data ?? {}) as Record<string, unknown>,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    read_at: typeof raw.read_at === 'string' ? raw.read_at : null,
  }
}

function useNotifications(userId: string, filter: string): NotificationsResponse {
  const [items, setItems] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!userId) {
        setItems([])
        setUnreadCount(0)
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (filter !== 'all') {
        query = query.eq('type', filter)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        setError(queryError.message)
        setLoading(false)
        return
      }

      const nextItems = ((data ?? []) as Record<string, unknown>[]).map(mapRow)
      setItems(nextItems)
      setUnreadCount(nextItems.filter((item) => item.read_at === null).length)
      setLoading(false)
    }

    void fetchNotifications()
  }, [userId, filter])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const inserted = mapRow((payload.new ?? {}) as Record<string, unknown>)

          setUnreadCount((prev) => prev + (inserted.read_at === null ? 1 : 0))

          const shouldInclude = filter === 'all' || inserted.type === filter
          if (!shouldInclude) return

          setItems((prev) => [inserted, ...prev].slice(0, 50))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, filter])

  const markAsReadLocally = (id: string) => {
    setItems((prev) =>
      prev.map((row) => (row.id === id && row.read_at === null ? { ...row, read_at: new Date().toISOString() } : row)),
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  return { items, loading, error, unreadCount, markAsReadLocally }
}

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationRecord
  onRead: (id: string) => void
}) {
  const navigate = useNavigate()
  const unread = item.read_at === null
  const style = getTypeStyle(item.type)
  const tag = item.tag?.trim() || style.label
  const pts = extractPoints(item)

  const handleClick = async () => {
    if (unread) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', item.id)

      onRead(item.id)
    }

    navigate(routeForType(item.type))
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="relative w-full rounded-2xl border border-slate-200/70 px-4 py-3 text-left transition hover:border-slate-300 hover:shadow-sm"
      style={{
        backgroundColor: unread ? 'var(--pl, #EBE9FF)' : 'transparent',
      }}
    >
      {unread ? <span className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-500" aria-hidden="true" /> : null}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] text-base"
            style={{ backgroundColor: style.iconBg }}
            aria-hidden="true"
          >
            {style.icon}
          </div>

          <div className="min-w-0">
            <p className={`truncate text-sm text-slate-900 ${unread ? 'font-semibold' : 'font-medium'}`}>
              {buildTitle(item)}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{buildSubtitle(item)}</p>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-slate-500">{formatTime(item.created_at)}</span>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.tagClass}`}>
                {tag}
              </span>
            </div>
          </div>
        </div>

        {pts !== null ? (
          <span className="inline-flex flex-shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
            +{pts}
          </span>
        ) : null}
      </div>
    </button>
  )
}

export default function NotificationsList({ userId, filter }: NotificationsListProps) {
  const { items, loading, error, unreadCount, markAsReadLocally } = useNotifications(userId, filter)

  const grouped = useMemo(() => {
    const groups = new Map<string, NotificationRecord[]>()

    for (const item of items) {
      const key = formatGroupLabel(item.created_at)
      const current = groups.get(key) ?? []
      current.push(item)
      groups.set(key, current)
    }

    return Array.from(groups.entries())
  }, [items])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
  }

  if (grouped.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        Aucune notification pour ce filtre.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Non lues: <span className="font-semibold text-slate-800">{unreadCount}</span>
      </div>

      {grouped.map(([groupLabel, groupItems]) => (
        <section key={groupLabel} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{groupLabel}</h3>

          <div className="space-y-2">
            {groupItems.map((item) => (
              <NotificationRow key={item.id} item={item} onRead={markAsReadLocally} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
