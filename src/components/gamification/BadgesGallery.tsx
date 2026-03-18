import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'

type BadgeCategory = 'Achats' | 'Communauté' | 'Niveaux' | 'Réseaux' | 'Écologie'

type BadgeItem = {
  id: string
  name: string
  description: string
  emoji: string
  category: BadgeCategory
  unlockHint: string
  earnedAt: string | null
}

type UseBadgesResult = {
  badges: BadgeItem[]
  loading: boolean
  error: string | null
}

type BadgesGalleryProps = {
  userId: string
}

const categoryColors: Record<BadgeCategory, string> = {
  Achats: '#EBE9FF',
  Communauté: '#E1F5EE',
  Niveaux: '#FAEEDA',
  Réseaux: '#FFF3EE',
  Écologie: '#EAF3DE',
}

function normalizeCategory(raw: unknown): BadgeCategory {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'achats' || value === 'purchases') return 'Achats'
  if (value === 'communauté' || value === 'communaute' || value === 'community') return 'Communauté'
  if (value === 'niveaux' || value === 'levels') return 'Niveaux'
  if (value === 'réseaux' || value === 'reseaux' || value === 'networks') return 'Réseaux'
  if (value === 'écologie' || value === 'ecologie' || value === 'ecology') return 'Écologie'
  return 'Achats'
}

function formatDate(value: string | null) {
  if (!value) return 'Date indisponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date indisponible'
  return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: '2-digit' })
}

function useBadges(userId: string): UseBadgesResult {
  const [badges, setBadges] = useState<BadgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setBadges([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      const [badgesRes, userBadgesRes] = await Promise.all([
        supabase.from('badges').select('*').order('created_at', { ascending: true }),
        supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', userId),
      ])

      if (cancelled) return

      if (badgesRes.error || userBadgesRes.error) {
        setLoading(false)
        setError(badgesRes.error?.message ?? userBadgesRes.error?.message ?? 'Impossible de charger les badges')
        setBadges([])
        return
      }

      const earnedMap = new Map<string, string | null>()
      for (const row of (userBadgesRes.data ?? []) as Array<{ badge_id: string; earned_at: string | null }>) {
        earnedMap.set(String(row.badge_id), row.earned_at ?? null)
      }

      const mapped = ((badgesRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id ?? ''),
        name: String(row.name ?? row.title ?? 'Badge'),
        description: String(row.description ?? 'Badge LoyalUp'),
        emoji: String(row.emoji ?? '🏅'),
        category: normalizeCategory(row.category),
        unlockHint: String(row.unlock_hint ?? row.how_to_unlock ?? 'Continuez à utiliser LoyalUp pour le débloquer.'),
        earnedAt: earnedMap.get(String(row.id ?? '')) ?? null,
      }))

      setBadges(mapped)
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [userId])

  return { badges, loading, error }
}

export default function BadgesGallery({ userId }: BadgesGalleryProps) {
  const { badges, loading, error } = useBadges(userId)
  const [openedLockedBadgeId, setOpenedLockedBadgeId] = useState<string | null>(null)

  const unlockedCount = useMemo(() => badges.filter((badge) => Boolean(badge.earnedAt)).length, [badges])
  const totalCount = badges.length

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Badges</h3>
        <span className="text-xs font-semibold text-slate-600">{unlockedCount} / {totalCount} débloqués</span>
      </header>

      {loading ? <p className="text-sm text-slate-500">Chargement des badges...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && !error ? (
        <div className="badges-grid gap-3">
          {badges.map((badge) => {
            const isUnlocked = Boolean(badge.earnedAt)
            const pastelBg = categoryColors[badge.category]
            const drawerOpen = openedLockedBadgeId === badge.id

            return (
              <article key={badge.id} className="rounded-xl border border-slate-200 p-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isUnlocked) return
                    setOpenedLockedBadgeId((prev) => (prev === badge.id ? null : badge.id))
                  }}
                  className="group relative w-full text-center"
                >
                  <div
                    className={[
                      'mx-auto inline-flex h-[50px] w-[50px] items-center justify-center rounded-[14px] text-xl transition-transform duration-200',
                      isUnlocked
                        ? 'border-2 border-violet-500 group-hover:scale-110'
                        : 'border border-slate-200 opacity-[0.28] grayscale',
                    ].join(' ')}
                    style={{ backgroundColor: isUnlocked ? pastelBg : '#F8FAFC' }}
                    aria-hidden="true"
                  >
                    {badge.emoji}
                  </div>

                  <p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{badge.name}</p>

                  {isUnlocked ? (
                    <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden w-52 -translate-x-1/2 -translate-y-[105%] rounded-lg border border-slate-200 bg-white p-2 text-left shadow-lg group-hover:block">
                      <p className="text-xs font-semibold text-slate-900">{badge.description}</p>
                      <p className="mt-1 text-[11px] text-slate-500">Obtenu le {formatDate(badge.earnedAt)}</p>
                    </div>
                  ) : null}
                </button>

                {!isUnlocked && drawerOpen ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Comment débloquer ce badge : {badge.unlockHint}
                    </p>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}

      <style>{`
        .badges-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        @media (min-width: 900px) {
          .badges-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  )
}
