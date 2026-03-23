import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { supabase } from '../../../shared/lib/supabaseClient'

type ConsumedRewardRow = {
  id: string
  client_id: string
  used_at: string
  reward_rule: {
    nom: string
    emoji: string
    points_required: number
  }
  profile: {
    full_name: string | null
    email: string | null
  } | null
}

type PeriodFilter = 7 | 30 | 90 | 'all'

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: 7, label: '7j' },
  { value: 30, label: '30j' },
  { value: 90, label: '90j' },
  { value: 'all', label: 'Tout' },
]

type ConsumedRewardsCardProps = {
  fournisseur_id: string | null
}

export function ConsumedRewardsCard({ fournisseur_id }: ConsumedRewardsCardProps) {
  const [rows, setRows] = useState<ConsumedRewardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodFilter>(30)

  useEffect(() => {
    if (!fournisseur_id) return

    let cancelled = false
    setLoading(true)

    const load = async () => {
      let query = supabase
        .from('client_rewards')
        .select('id, client_id, used_at, reward_rules(nom, emoji, points_required)')
        .eq('fournisseur_id', fournisseur_id)
        .eq('status', 'used')
        .order('used_at', { ascending: false })
        .limit(100)

      if (period !== 'all') {
        const since = new Date()
        since.setDate(since.getDate() - period)
        query = query.gte('used_at', since.toISOString())
      }

      const { data, error } = await query
      if (error || cancelled) return

      const clientIds = [...new Set((data ?? []).map((r) => String(r.client_id)))]
      const { data: profiles } = clientIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', clientIds)
        : { data: [] }

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

      if (!cancelled) {
        setRows(
          (data ?? [])
            .map((row) => {
              const ruleRaw = row.reward_rules as unknown
              const rule = Array.isArray(ruleRaw) ? ruleRaw[0] ?? null : ruleRaw as { nom?: string; emoji?: string; points_required?: number } | null
              if (!rule || !row.used_at) return null
              const profile = profileMap.get(String(row.client_id)) ?? null

              return {
                id: String(row.id),
                client_id: String(row.client_id),
                used_at: String(row.used_at),
                reward_rule: {
                  nom: (rule.nom as string | undefined)?.trim() || 'Récompense',
                  emoji: (rule.emoji as string | undefined)?.trim() || '🎁',
                  points_required: Number(rule.points_required ?? 0),
                },
                profile: profile ? { full_name: profile.full_name as string | null, email: profile.email as string | null } : null,
              } satisfies ConsumedRewardRow
            })
            .filter((r): r is ConsumedRewardRow => r !== null)
        )
        setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [fournisseur_id, period])

  const sectionClass = 'space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4'
  const labelClass = 'text-xs font-medium text-zinc-400'

  return (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Récompenses consommées</h3>
          {!loading && (
            <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              {rows.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                period === opt.value
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">Aucune récompense consommée sur cette période.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{row.reward_rule.emoji}</span>
                <div>
                  <p className="text-sm text-zinc-100">{row.reward_rule.nom}</p>
                  <p className={labelClass}>
                    {row.profile?.full_name ?? row.profile?.email ?? row.client_id.slice(0, 8)}
                    {' · '}
                    {row.reward_rule.points_required.toLocaleString('fr-FR')} pts déduits
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-xs text-zinc-500">
                {new Date(row.used_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {' '}
                {new Date(row.used_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
