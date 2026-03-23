import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../auth/hooks/useAuth'
import { getUsedRewards, type UsedRewardItem } from '../services/loyaltyService'
import { EmptyState, Skeleton } from '../../../shared/components/client-ui'

type UsedRewardsListProps = {
  fournisseur_id?: string
}

export function UsedRewardsList({ fournisseur_id }: UsedRewardsListProps) {
  const { user } = useAuth()
  const [items, setItems] = useState<UsedRewardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    setLoading(true)
    setError(null)

    getUsedRewards(user.id, fournisseur_id)
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user?.id, fournisseur_id])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
    )
  }

  if (error) {
    return <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucune récompense utilisée"
        description="Vos récompenses consommées apparaîtront ici."
        icon={<CheckCircle2 className="h-5 w-5" />}
      />
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{item.reward_rule.emoji}</span>
            <div>
              <p className="text-sm font-medium text-slate-800">{item.reward_rule.nom}</p>
              <p className="text-xs text-slate-500">{item.fournisseur_nom} · {item.reward_rule.points_required.toLocaleString('fr-FR')} pts</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-slate-400">
              {new Date(item.used_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Utilisée
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
