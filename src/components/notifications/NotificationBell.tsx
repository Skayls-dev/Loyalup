import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabaseClient'

type NotificationBellProps = {
  userId: string
}

type NotificationMini = {
  id: string
  type: string
  title: string
  createdAt: string
  readAt: string | null
}

type TypeStyle = {
  icon: string
  iconBg: string
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  points: { icon: '💰', iconBg: '#EBE9FF' },
  challenge: { icon: '🎯', iconBg: '#EAF3DE' },
  tier_upgrade: { icon: '🏆', iconBg: '#FAEEDA' },
  badge: { icon: '🏅', iconBg: '#FBEAF0' },
  network: { icon: '🌐', iconBg: '#FFF3EE' },
  streak: { icon: '🔥', iconBg: '#FFF3EE' },
}

function normalizeType(rawType: string): string {
  const value = rawType.toLowerCase()
  if (value.includes('point') || value.includes('xp')) return 'points'
  if (value.includes('challenge') || value.includes('defi') || value.includes('défi')) return 'challenge'
  if (value.includes('tier') || value.includes('level') || value.includes('niveau')) return 'tier_upgrade'
  if (value.includes('badge')) return 'badge'
  if (value.includes('network') || value.includes('reseau') || value.includes('réseau')) return 'network'
  if (value.includes('streak')) return 'streak'
  return rawType
}

function getTypeStyle(type: string): TypeStyle {
  return TYPE_STYLES[normalizeType(type)] ?? { icon: '🔔', iconBg: '#F1F5F9' }
}

function extractTitle(raw: Record<string, unknown>): string {
  if (typeof raw.title === 'string' && raw.title.trim()) return raw.title.trim()

  const type = String(raw.type ?? '')
  if (type.includes('points')) return 'Points crédités'
  if (type.includes('challenge')) return 'Progression défi'
  if (type.includes('tier')) return 'Niveau amélioré'
  if (type.includes('badge')) return 'Badge débloqué'
  if (type.includes('network')) return 'Actualité réseau'
  return 'Nouvelle notification'
}

function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'maintenant'

  const diff = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'à l\'instant'
  if (diff < hour) return `il y a ${Math.max(1, Math.floor(diff / minute))} min`
  if (diff < day) return `il y a ${Math.max(1, Math.floor(diff / hour))} h`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function routeForType(type: string): string {
  const normalized = normalizeType(type)
  if (normalized === 'points') return '/dashboard/transactions'
  if (normalized === 'challenge') return '/dashboard/gamification'
  if (normalized === 'tier_upgrade') return '/dashboard/gamification'
  if (normalized === 'badge') return '/dashboard/gamification#badges'
  if (normalized === 'network') return '/dashboard/networks'
  if (normalized === 'streak') return '/dashboard/gamification'
  return '/dashboard/notifications'
}

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const handler = (event: MouseEvent | TouchEvent) => {
      if (!ref.current) return
      const target = event.target as Node | null
      if (target && ref.current.contains(target)) return
      onOutside()
    }

    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)

    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [onOutside])

  return ref
}

function useUnreadCount(userId: string) {
  const [unreadCount, setUnreadCount] = useState(0)

  const refetch = async () => {
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
    void refetch()
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notification-bell-unread-${userId}`)
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

  return { unreadCount, refetch }
}

function useLatestNotifications(userId: string) {
  const [items, setItems] = useState<NotificationMini[]>([])

  const refetch = async () => {
    if (!userId) {
      setItems([])
      return
    }

    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, data, created_at, read_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    type Row = {
      id: string
      type: string
      title?: string | null
      data?: Record<string, unknown> | null
      created_at: string
      read_at: string | null
    }

    const mapped = ((data ?? []) as Row[]).map((row) => ({
      id: row.id,
      type: row.type,
      title: typeof row.title === 'string' && row.title.trim() ? row.title : extractTitle(row as unknown as Record<string, unknown>),
      createdAt: row.created_at,
      readAt: row.read_at,
    }))

    setItems(mapped)
  }

  useEffect(() => {
    void refetch()
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notification-bell-list-${userId}`)
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

  const markAllRead = async () => {
    if (!userId) return

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)

    await refetch()
  }

  const markOneRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null)
  }

  return { items, refetch, markAllRead, markOneRead }
}

function NotificationMiniRow({
  item,
  onClick,
}: {
  item: NotificationMini
  onClick: (item: NotificationMini) => void
}) {
  const unread = item.readAt === null
  const style = getTypeStyle(item.type)

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="relative flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50"
      style={{ backgroundColor: unread ? 'var(--pl, #EBE9FF)' : 'transparent' }}
    >
      {unread ? <span className="absolute left-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-blue-500" aria-hidden="true" /> : null}

      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] text-sm"
        style={{ backgroundColor: style.iconBg }}
        aria-hidden="true"
      >
        {style.icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs ${unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{item.title}</p>
      </div>

      <span className="flex-shrink-0 text-[11px] text-slate-500">{formatRelativeTime(item.createdAt)}</span>
    </button>
  )
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const { unreadCount, refetch: refetchUnread } = useUnreadCount(userId)
  const { items, markAllRead, markOneRead } = useLatestNotifications(userId)

  const rootRef = useClickOutside<HTMLDivElement>(() => setOpen(false))

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search, location.hash])

  const label = useMemo(() => {
    if (unreadCount <= 0) return 'Aucune notification non lue'
    if (unreadCount === 1) return '1 notification non lue'
    return `${unreadCount} notifications non lues`
  }, [unreadCount])

  const handleMarkAllRead = async () => {
    await markAllRead()
    await refetchUnread()
  }

  const handleMiniClick = async (item: NotificationMini) => {
    if (item.readAt === null) {
      await markOneRead(item.id)
      await refetchUnread()
    }
    navigate(routeForType(item.type))
  }

  return (
    <div ref={rootRef} className="relative">
      <style>
        {`@keyframes notif-pulse {
            0% { transform: scale(1); opacity: 1; }
            70% { transform: scale(1.35); opacity: 0.45; }
            100% { transform: scale(1); opacity: 1; }
          }`}
      </style>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-[8px] border border-slate-200 bg-white text-sm text-slate-700 transition hover:bg-slate-50"
        aria-label={label}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 ? (
          <span
            className="absolute right-1 top-1 h-[7px] w-[7px] rounded-full bg-red-500"
            style={{ animation: 'notif-pulse 1.4s ease-out infinite' }}
            aria-hidden="true"
          />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[360px] max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="text-xs font-medium text-indigo-600 transition hover:text-indigo-700"
            >
              Tout marquer lu
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto px-2 py-2">
            {items.length ? (
              <div className="space-y-1">
                {items.map((item) => (
                  <NotificationMiniRow key={item.id} item={item} onClick={handleMiniClick} />
                ))}
              </div>
            ) : (
              <p className="px-2 py-6 text-center text-sm text-slate-500">Aucune notification récente</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard/notifications')}
            className="w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
          >
            Voir toutes les notifications →
          </button>
        </div>
      ) : null}
    </div>
  )
}
