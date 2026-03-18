import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../shared/lib/supabaseClient'
import { useToast } from '../components/notifications/ToastSystem'
import type { ToastType } from '../components/notifications/ToastSystem'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RealtimeNotif = {
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

export type UseRealtimeNotificationsOptions = {
  /** Play /sounds/notif.mp3 on each incoming notification. Default: false. */
  soundEnabled?: boolean
}

export type UseRealtimeNotificationsResult = {
  isConnected: boolean
  lastNotif: RealtimeNotif | null
}

// ─── React Query cache keys ───────────────────────────────────────────────────

/**
 * Query key for the flat notifications list.
 * Components that call useQuery with this key stay in sync automatically.
 */
export const notificationsQueryKey = (userId: string) =>
  ['notifications', userId] as const

/**
 * Query key for the unread notification count.
 * Incremented optimistically on each realtime INSERT.
 */
export const unreadCountQueryKey = (userId: string) =>
  ['notifications', userId, 'unread'] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNotifUrl(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('point') || t.includes('xp') || t.includes('reward')) return '/dashboard/transactions'
  if (t.includes('challenge') || t.includes('defi') || t.includes('défi')) return '/dashboard/gamification'
  if (t.includes('tier') || t.includes('level') || t.includes('niveau')) return '/dashboard/gamification'
  if (t.includes('badge')) return '/dashboard/gamification#badges'
  if (t.includes('network') || t.includes('reseau') || t.includes('réseau')) return '/dashboard/networks'
  if (t.includes('streak')) return '/dashboard/gamification'
  return '/dashboard/notifications'
}

function mapToToastType(type: string): ToastType {
  const t = type.toLowerCase()
  if (t.includes('point') || t.includes('xp') || t.includes('reward')) return 'points'
  if (t.includes('challenge') || t.includes('defi') || t.includes('défi')) return 'challenge'
  if (t.includes('tier') || t.includes('level') || t.includes('niveau')) return 'tier'
  if (t.includes('badge')) return 'badge'
  if (t.includes('streak')) return 'streak'
  return 'points'
}

const TOAST_LABELS: Record<ToastType, string> = {
  points: 'Points mis à jour',
  challenge: 'Défi mis à jour',
  tier: 'Niveau amélioré',
  badge: 'Badge débloqué',
  streak: 'Streak mis à jour',
}

function resolveTitle(notif: RealtimeNotif): string {
  if (notif.title?.trim()) return notif.title
  const msg = notif.data?.message
  if (typeof msg === 'string' && msg.trim()) return msg
  return TOAST_LABELS[mapToToastType(notif.type)]
}

function resolveSubtitle(notif: RealtimeNotif): string {
  if (notif.subtitle?.trim()) return notif.subtitle
  const msg = notif.data?.message
  if (typeof msg === 'string' && msg.trim()) return msg
  return 'Nouvelle activité sur votre compte.'
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRealtimeNotifications(
  userId: string,
  options: UseRealtimeNotificationsOptions = {},
): UseRealtimeNotificationsResult {
  const { soundEnabled = false } = options

  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [isConnected, setIsConnected] = useState(false)
  const [lastNotif, setLastNotif] = useState<RealtimeNotif | null>(null)

  // Lazily-initialised Audio element — created only when first needed
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Sync soundEnabled into a ref so the subscription callback always sees the
  // latest value without needing to recreate the channel on every render
  const soundEnabledRef = useRef(soundEnabled)
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as RealtimeNotif

          // 1. Prepend to React Query notifications list cache
          queryClient.setQueryData<RealtimeNotif[]>(
            notificationsQueryKey(userId),
            (prev) => [notif, ...(prev ?? [])],
          )

          // 2. Increment cached unread count
          queryClient.setQueryData<number>(
            unreadCountQueryKey(userId),
            (prev) => (prev ?? 0) + 1,
          )

          // 3. Fire toast
          showToast({
            type: mapToToastType(notif.type),
            title: resolveTitle(notif),
            subtitle: resolveSubtitle(notif),
            points: notif.points ?? undefined,
          })

          // 4. Play sound
          if (soundEnabledRef.current) {
            if (!audioRef.current) {
              audioRef.current = new Audio('/sounds/notif.mp3')
              audioRef.current.preload = 'none'
            }
            void audioRef.current.play().catch(() => {
              // Autoplay may be blocked before first user interaction — silently ignore
            })
          }

          // 5. Browser push notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(resolveTitle(notif), {
              body: resolveSubtitle(notif),
              icon: '/icons/loyalup-192.png',
              badge: '/icons/badge-72.png',
              data: { url: getNotifUrl(notif.type) },
            })
          }

          setLastNotif(notif)
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      setIsConnected(false)
      void supabase.removeChannel(channel)
    }
  }, [userId, queryClient, showToast])

  return { isConnected, lastNotif }
}
