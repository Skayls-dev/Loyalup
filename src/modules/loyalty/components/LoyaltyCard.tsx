import { memo, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LoyaltyCard as LoyaltyCardModel } from '../hooks/useLoyalty'
import { useAuth } from '../../auth/hooks/useAuth'
import { usePointsRealtime } from '../hooks/usePointsRealtime'
import { PointsBalance } from './PointsBalance'
import { ProgressBar } from './ProgressBar'
import { supabase } from '../../../shared/lib/supabaseClient'

type LoyaltyCardProps = {
  card: LoyaltyCardModel
  index: number
}

function LoyaltyCardComponent({ card, index }: LoyaltyCardProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [previousPoints, setPreviousPoints] = useState(card.displaySolde)
  const [networkBadges, setNetworkBadges] = useState<Array<{ id: string; name: string; emoji: string; bonusPct: number }>>([])

  const { solde: liveSolde } = usePointsRealtime({
    client_id: user?.id ?? '',
    fournisseur_id: card.fournisseur.id,
  })

  const effectiveSolde = user?.id ? Math.max(liveSolde, card.displaySolde) : card.displaySolde

  useEffect(() => {
    if (effectiveSolde !== previousPoints) {
      setPreviousPoints(effectiveSolde)
    }
  }, [effectiveSolde, previousPoints])

  useEffect(() => {
    const loadNetworkBadges = async () => {
      const { data, error } = await supabase
        .from('network_members')
        .select('network_id, networks!inner(id, slug, name, emoji, points_multiplier)')
        .eq('fournisseur_id', card.fournisseur.id)
        .eq('status', 'active')

      if (error) {
        setNetworkBadges([])
        return
      }

      const rows = (data ?? []) as Array<{
        network_id: string
        networks:
          | { id: string; slug: string; name: Record<string, string>; emoji: string; points_multiplier: number }
          | Array<{ id: string; slug: string; name: Record<string, string>; emoji: string; points_multiplier: number }>
          | null
      }>

      setNetworkBadges(
        rows
          .map((row) => {
            const network = Array.isArray(row.networks) ? row.networks[0] : row.networks
            if (!network) {
              return null
            }

            return {
              id: network.id,
              name: network.name?.fr ?? network.name?.en ?? network.slug,
              emoji: network.emoji ?? '✨',
              bonusPct: Math.round((Number(network.points_multiplier ?? 1) - 1) * 100),
            }
          })
          .filter((item): item is { id: string; name: string; emoji: string; bonusPct: number } => Boolean(item)),
      )
    }

    void loadNetworkBadges()
  }, [card.fournisseur.id])

  const pointsNeeded = card.nextReward ? Math.max(0, card.nextReward.points_required - effectiveSolde) : 0

  const accent = useMemo<'emerald' | 'blue' | 'amber'>(() => {
    const hash = card.fournisseur.id.charCodeAt(0) % 3
    if (hash === 0) {
      return 'emerald'
    }

    if (hash === 1) {
      return 'blue'
    }

    return 'amber'
  }, [card.fournisseur.id])

  return (
    <button
      type="button"
      onClick={() => navigate(`/client/history?provider=${card.fournisseur.id}`)}
      className="w-full rounded-2xl border border-slate-200/60 bg-white/80 p-4 text-left shadow-sm shadow-slate-900/5 backdrop-blur-xl transition hover:bg-slate-50"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">🏪 {card.fournisseur.nom_commerce}</p>
          <p className="text-xs text-slate-500">Programme fidélité</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-600">
          {card.total_visites} visites
        </span>
      </div>

      {networkBadges.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {networkBadges.map((badge) => (
            <span
              key={badge.id}
              title={`Bonus +${badge.bonusPct}% grâce au réseau ${badge.name}`}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700"
            >
              {badge.emoji}
            </span>
          ))}
        </div>
      ) : null}

      <PointsBalance points={effectiveSolde} previousPoints={previousPoints} color={accent} />

      <div className="mt-3">
        <ProgressBar
          current={effectiveSolde}
          target={card.nextReward?.points_required ?? Math.max(1, effectiveSolde)}
          color={accent}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {card.nextReward
          ? `${pointsNeeded} pts avant ${card.nextReward.nom}`
          : 'Récompense disponible maintenant'}
      </p>
    </button>
  )
}

export const LoyaltyCard = memo(LoyaltyCardComponent, (prev, next) => {
  return prev.card.displaySolde === next.card.displaySolde && prev.card.fournisseur.id === next.card.fournisseur.id
})
