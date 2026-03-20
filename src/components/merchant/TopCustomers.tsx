import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabaseClient'

export interface TopCustomersProps {
  merchantId: string
  className?: string
}

type Tier = 'Gold' | 'Silver' | 'Bronze'

type TopCustomer = {
  userId: string
  name: string
  visits: number
  tier: Tier
  points: number
}

const gradientPairs = [
  ['#A78BFA', '#7C3AED'],
  ['#F59E0B', '#EF4444'],
  ['#14B8A6', '#0EA5E9'],
  ['#EC4899', '#8B5CF6'],
]

function tierFromLevel(level: number): Tier {
  if (level >= 8) return 'Gold'
  if (level >= 4) return 'Silver'
  return 'Bronze'
}

function initials(name: string): string {
  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return 'CL'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function displayName(lastName: string | null | undefined, userId: string): string {
  if (lastName?.trim()) return lastName.trim()
  return `Client ${userId.slice(0, 6)}`
}

export function TopCustomers({ merchantId, className = '' }: TopCustomersProps) {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<TopCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!merchantId) {
      setCustomers([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('client_id, points_credited')
        .eq('fournisseur_id', merchantId)
        .eq('status', 'validated')

      if (cancelled) return

      if (txError) {
        setLoading(false)
        setError(txError.message)
        setCustomers([])
        return
      }

      const pointsByClient = new Map<string, { points: number; visits: number }>()

      for (const row of (txData ?? []) as Array<{ client_id: string | null; points_credited: number | null }>) {
        if (!row.client_id) continue
        const existing = pointsByClient.get(row.client_id) ?? { points: 0, visits: 0 }
        existing.points += Number(row.points_credited ?? 0)
        existing.visits += 1
        pointsByClient.set(row.client_id, existing)
      }

      const rankedIds = [...pointsByClient.entries()]
        .sort((a, b) => b[1].points - a[1].points)
        .slice(0, 4)
        .map(([clientId]) => clientId)

      if (rankedIds.length === 0) {
        setLoading(false)
        setCustomers([])
        return
      }

      const [profilesRes, levelsRes] = await Promise.all([
        supabase.from('profiles').select('id, nom').in('id', rankedIds),
        supabase.from('client_levels').select('client_id, current_level').in('client_id', rankedIds),
      ])

      if (cancelled) return

      if (profilesRes.error || levelsRes.error) {
        setLoading(false)
        setError(profilesRes.error?.message ?? levelsRes.error?.message ?? 'Impossible de charger les clients')
        setCustomers([])
        return
      }

      const profileMap = new Map<string, { nom?: string | null }>()
      for (const row of (profilesRes.data ?? []) as Array<{ id: string; nom?: string | null }>) {
        profileMap.set(row.id, { nom: row.nom ?? null })
      }

      const levelMap = new Map<string, number>()
      for (const row of (levelsRes.data ?? []) as Array<{ client_id: string; current_level: number | null }>) {
        levelMap.set(row.client_id, Number(row.current_level ?? 1))
      }

      const list = rankedIds.map((userId) => {
        const profile = profileMap.get(userId)
        const pointsInfo = pointsByClient.get(userId) ?? { points: 0, visits: 0 }

        return {
          userId,
          name: displayName(profile?.nom, userId),
          visits: pointsInfo.visits,
          tier: tierFromLevel(levelMap.get(userId) ?? 1),
          points: pointsInfo.points,
        } satisfies TopCustomer
      })

      setCustomers(list)
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [merchantId])

  const topRows = useMemo(() => customers.slice(0, 4), [customers])

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <header className="mb-3">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Top clients</p>
      </header>

      <div className="space-y-2">
        {topRows.map((customer, index) => {
          const [fromColor, toColor] = gradientPairs[index % gradientPairs.length]

          return (
            <button
              key={customer.userId}
              type="button"
              onClick={() => navigate(`/merchant/customers/${customer.userId}`)}
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50/35"
            >
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-body text-xs font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${fromColor}, ${toColor})` }}
                aria-hidden="true"
              >
                {initials(customer.name)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-dark">{customer.name}</p>
                <p className="mt-0.5 truncate font-body text-xs text-gray-500">
                  {customer.visits.toLocaleString('fr-FR')} visites · {customer.tier}
                </p>
              </div>

              <p className="shrink-0 text-right font-display text-base font-bold text-violet-600">
                {customer.points.toLocaleString('fr-FR')} pts
              </p>
            </button>
          )
        })}

        {!loading && topRows.length === 0 ? <p className="font-body text-sm text-gray-500">Aucun client classe pour le moment.</p> : null}
      </div>

      {loading ? <p className="pt-3 font-body text-xs text-gray-500">Chargement...</p> : null}
      {error ? <p className="pt-3 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
