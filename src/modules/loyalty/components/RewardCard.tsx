import { useState } from 'react'
import { CheckCircle2, Gift, Lock, MapPin } from 'lucide-react'
import type { RewardCatalogItem } from '../services/loyaltyService'

type RewardCardProps = {
  reward: RewardCatalogItem
  onUse: (reward: RewardCatalogItem) => Promise<void>
}

export function RewardCard({ reward, onUse }: RewardCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isAvailable = reward.status === 'available'
  const rewardDeliveryType = reward.reward_rule.reward_delivery_type === 'digital_code' ? 'digital_code' : 'in_store'
  const isNew = reward.unlocked_at ? Date.now() - new Date(reward.unlocked_at).getTime() < 15000 : false
  const isCloseToUnlock = !isAvailable && reward.points_needed > 0 && reward.points_needed <= 25

  const badgeClass = isAvailable
    ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
    : isCloseToUnlock
      ? 'border-amber-200 bg-amber-100 text-amber-700'
      : 'border-slate-200 bg-slate-100 text-slate-600'

  const badgeLabel = isAvailable
    ? 'Disponible'
    : isCloseToUnlock
      ? `Bientot - ${reward.points_needed} pts`
      : `Encore ${reward.points_needed} pts`

  const handleUse = async () => {
    if (!isAvailable) {
      return
    }

    setConfirmOpen(true)
  }

  const handleConfirmUse = async () => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      await onUse(reward)
      setConfirmOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <article
      className={`rounded-xl border p-4 transition ${
        isAvailable ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white/80 opacity-75'
      } ${isNew ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg">
            {reward.reward_rule.emoji} {reward.reward_rule.nom}
          </p>
          <p className="text-xs text-slate-500">{reward.fournisseur_nom}</p>
          <p className="text-xs text-slate-500">{reward.reward_rule.points_required} pts</p>
          <p className="mt-1 text-xs text-slate-500">{reward.reward_rule.description}</p>
        </div>

        <span
          className={`rounded-full border px-2 py-1 text-xs ${badgeClass}`}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="mt-3">
        {isAvailable ? (
          rewardDeliveryType === 'in_store' ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-xs font-medium text-emerald-700">
                Récompense prête — présentez votre app en boutique lors de votre prochain achat
              </p>
            </div>
          ) : (
            // TODO V2: digital_code flow — generate and display promo code instead of consuming directly
            <button
              type="button"
              onClick={() => {
                handleUse().catch(() => null)
              }}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              <Gift className="h-4 w-4" />
              Utiliser
            </button>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <p className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Solde actuel : {reward.current_points} pts
            </p>
            {isCloseToUnlock ? (
              <p className="inline-flex items-center gap-2 text-amber-600">
                <Gift className="h-4 w-4" />
                Presque debloquee
              </p>
            ) : null}
            {reward.points_needed === 0 ? (
              <p className="inline-flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Éligible au prochain déblocage
              </p>
            ) : null}
          </div>
        )}
      </div>

      {confirmOpen && rewardDeliveryType === 'digital_code' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`reward-confirm-title-${reward.id}`}
            className="w-full max-w-md rounded-2xl border border-white/70 bg-white/95 p-5 text-slate-900 shadow-xl shadow-slate-900/10 backdrop-blur-xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
                {reward.reward_rule.emoji}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confirmer l'utilisation</p>
                <h3 id={`reward-confirm-title-${reward.id}`} className="mt-1 text-lg font-semibold text-slate-900">
                  {reward.reward_rule.nom}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {reward.fournisseur_nom}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="text-sm text-slate-700">
                Cette action va utiliser <span className="font-semibold text-slate-900">{reward.reward_rule.points_required.toLocaleString('fr-FR')} pts</span> pour débloquer l'avantage maintenant.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Après validation, la récompense sera marquée comme consommée.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  handleConfirmUse().catch(() => null)
                }}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Gift className="h-4 w-4" />
                {isSubmitting ? 'Utilisation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}
