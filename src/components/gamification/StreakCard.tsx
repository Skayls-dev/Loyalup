import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'

type StreakCardProps = {
  userId: string
}

type UseStreakResult = {
  streakDays: number
  lastActivity: string | null
  loading: boolean
  error: string | null
  resuming: boolean
  refetch: () => Promise<void>
  resumeToday: () => Promise<void>
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isOlderThan48Hours(value: string | null) {
  if (!value) return false
  const lastActivity = new Date(value)
  if (Number.isNaN(lastActivity.getTime())) return false
  return Date.now() - lastActivity.getTime() > 48 * 60 * 60 * 1000
}

async function fetchUserStreak(userId: string) {
  const primary = await supabase
    .from('user_streaks')
    .select('streak_days, last_activity')
    .eq('user_id', userId)
    .maybeSingle<{ streak_days: number | null; last_activity: string | null }>()

  if (!primary.error && primary.data) {
    return {
      streakDays: Number(primary.data.streak_days ?? 0),
      lastActivity: primary.data.last_activity ?? null,
    }
  }

  const fallback = await supabase
    .from('client_streaks')
    .select('current_streak, last_visit_date')
    .eq('client_id', userId)
    .is('fournisseur_id', null)
    .maybeSingle<{ current_streak: number | null; last_visit_date: string | null }>()

  if (fallback.error) {
    throw new Error(fallback.error.message)
  }

  return {
    streakDays: Number(fallback.data?.current_streak ?? 0),
    lastActivity: fallback.data?.last_visit_date ?? null,
  }
}

function useStreak(userId: string): UseStreakResult {
  const [streakDays, setStreakDays] = useState(0)
  const [lastActivity, setLastActivity] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(false)

  const refetch = async () => {
    if (!userId) {
      setStreakDays(0)
      setLastActivity(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchUserStreak(userId)
      setStreakDays(data.streakDays)
      setLastActivity(data.lastActivity)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger le streak')
    } finally {
      setLoading(false)
    }
  }

  const resumeToday = async () => {
    if (!userId) return

    setResuming(true)
    setError(null)

    try {
      const { error: invokeError } = await supabase.functions.invoke('update-streak', {
        body: { client_id: userId },
      })

      if (invokeError) {
        throw new Error(invokeError.message)
      }

      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de reprendre le streak')
    } finally {
      setResuming(false)
    }
  }

  useEffect(() => {
    void refetch()
  }, [userId])

  return { streakDays, lastActivity, loading, error, resuming, refetch, resumeToday }
}

async function awardStreakBadge(userId: string) {
  const attempts = [
    { user_id: userId, badge_code: 'streak-7d' },
    { client_id: userId, badge_code: 'streak-7d' },
  ]

  for (const args of attempts) {
    const { error } = await supabase.rpc('award_badge', args)
    if (!error) {
      return
    }
  }

  await supabase.functions.invoke('check-badges', {
    body: {
      client_id: userId,
      trigger_type: 'streak_days',
    },
  })
}

function DaySlot({ day, active, isFinal }: { day: number; active: boolean; isFinal: boolean }) {
  if (isFinal) {
    return (
      <div
        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border text-[10px] font-bold"
        style={{
          backgroundColor: '#FFF3C4',
          borderColor: '#E0B23B',
          color: '#A46A00',
          fontFamily: 'var(--font-display, Syne, sans-serif)',
          opacity: active ? 1 : 0.72,
        }}
      >
        7j
      </div>
    )
  }

  return (
    <div
      className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border text-sm"
      style={
        active
          ? {
              backgroundColor: '#FF6B35',
              borderColor: '#FF6B35',
              color: '#FFFFFF',
            }
          : {
              backgroundColor: '#F3F4F6',
              borderColor: '#CBD5E1',
              borderStyle: 'dashed',
              color: '#94A3B8',
              opacity: 0.4,
            }
      }
      title={`Jour ${day}`}
    >
      🔥
    </div>
  )
}

export default function StreakCard({ userId }: StreakCardProps) {
  const { streakDays, lastActivity, loading, error, resuming, resumeToday } = useStreak(userId)
  const awardRef = useRef<string | null>(null)
  const streakVisualDays = clamp(streakDays, 0, 7)
  const remaining = Math.max(0, 7 - streakDays)
  const lost = streakDays === 0 && isOlderThan48Hours(lastActivity)
  const unlocked = streakDays >= 7

  useEffect(() => {
    if (!userId || !unlocked) return

    const key = `${userId}:streak-7d`
    if (awardRef.current === key) return
    awardRef.current = key

    void awardStreakBadge(userId)
  }, [unlocked, userId])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <style>
        {`@keyframes streak-confetti-fall {
            0% { transform: translateY(-24px) rotate(0deg); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translateY(150px) rotate(320deg); opacity: 0; }
          }
          @keyframes streak-confetti-sway {
            0%, 100% { margin-left: -6px; }
            50% { margin-left: 6px; }
          }`}
      </style>

      {unlocked ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 overflow-hidden">
          {Array.from({ length: 14 }).map((_, index) => {
            const colors = ['#FF6B35', '#FFD23F', '#5B4FE8', '#00C9A7']
            return (
              <span
                key={index}
                className="absolute top-0 block h-2 w-2 rounded-sm"
                style={{
                  left: `${6 + index * 6.5}%`,
                  backgroundColor: colors[index % colors.length],
                  animation: `streak-confetti-fall ${1.8 + (index % 4) * 0.22}s linear infinite, streak-confetti-sway ${1.2 + (index % 3) * 0.18}s ease-in-out infinite`,
                  animationDelay: `${index * 0.07}s`,
                }}
              />
            )
          })}
        </div>
      ) : null}

      <div className="relative space-y-4">
        <div className="space-y-1">
          <div
            className="text-[2.8rem] leading-none"
            style={{
              color: '#FF6B35',
              fontFamily: 'var(--font-display, Syne, sans-serif)',
              fontWeight: 800,
            }}
          >
            {streakDays}
          </div>
          <p className="text-sm text-slate-500">jours consécutifs</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-8 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-5 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {Array.from({ length: 7 }).map((_, index) => {
                const day = index + 1
                const isFinal = day === 7
                return <DaySlot key={day} day={day} active={day <= streakVisualDays} isFinal={isFinal} />
              })}
            </div>

            {lost ? (
              <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm font-medium text-rose-700">Streak perdu 😢</p>
                <button
                  type="button"
                  onClick={() => void resumeToday()}
                  disabled={resuming}
                  className="inline-flex items-center justify-center rounded-full bg-[#FF6B35] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resuming ? 'Reprise...' : "Reprendre aujourd'hui"}
                </button>
              </div>
            ) : unlocked ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                Badge Streak 7j débloqué ! 🎉
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Encore <span className="font-semibold text-[#FF6B35]">{remaining} jours</span> pour +400 pts
              </p>
            )}
          </>
        )}

        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </div>
    </div>
  )
}