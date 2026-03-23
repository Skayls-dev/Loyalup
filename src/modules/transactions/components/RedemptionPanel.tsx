import { useEffect, useState } from 'react'
import type { PendingTransactionPayload } from '../../qr/services/qrService'
import type { Profile } from '../../../shared/types'
import { supabase } from '../../../shared/lib/supabaseClient'

type RedemptionPanelProps = {
  pendingTransaction: PendingTransactionPayload
  clientProfile: Profile | null
  clientPoints: number
  totalVisites?: number
  onDismiss: () => void
}

type AvailableRewardItem = {
  id: string
  reward_rule_id: string
  unlocked_at: string | null
  reward_rule: {
    nom: string
    emoji: string
    points_required: number
    reward_delivery_type: 'in_store' | 'digital_code'
    requires_physical_presence: boolean
  }
}

export function RedemptionPanel({
  pendingTransaction,
  clientProfile: _clientProfile,
  clientPoints: _clientPoints,
  totalVisites: _totalVisites = 0,
  onDismiss,
}: RedemptionPanelProps) {
  const [availableRewards, setAvailableRewards] = useState<AvailableRewardItem[]>([])
  const [rewardsLoading, setRewardsLoading] = useState(false)
  const [consumingRewardId, setConsumingRewardId] = useState<string | null>(null)
  const [consumeRewardError, setConsumeRewardError] = useState<Record<string, string>>({})
  const [consumeRewardSuccess, setConsumeRewardSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadPanelData = async () => {
      setRewardsLoading(true)
      setConsumeRewardSuccess(null)

      try {
        const availableRewardsResult = await supabase
          .from('client_rewards')
          .select('id, reward_rule_id, unlocked_at, reward_rules(nom, emoji, points_required, reward_delivery_type, requires_physical_presence)')
          .eq('client_id', pendingTransaction.client_id)
          .eq('fournisseur_id', pendingTransaction.fournisseur_id)
          .eq('status', 'available')

        if (!cancelled) {
          if (availableRewardsResult.error) {
            throw availableRewardsResult.error
          }

          const mappedRewards = (availableRewardsResult.data ?? [])
            .map((row) => {
              const rewardRuleRaw = row.reward_rules as unknown
              const rewardRule = Array.isArray(rewardRuleRaw)
                ? rewardRuleRaw[0] ?? null
                : rewardRuleRaw

              if (!rewardRule || typeof rewardRule !== 'object') {
                return null
              }

              const typedRewardRule = rewardRule as {
                nom?: string | null
                emoji?: string | null
                points_required?: number | null
                reward_delivery_type?: 'in_store' | 'digital_code' | null
                requires_physical_presence?: boolean | null
              }

              return {
                id: String(row.id),
                reward_rule_id: String(row.reward_rule_id),
                unlocked_at: row.unlocked_at ? String(row.unlocked_at) : null,
                reward_rule: {
                  nom: typedRewardRule.nom?.trim() || 'Récompense',
                  emoji: typedRewardRule.emoji?.trim() || '🎁',
                  points_required: Number(typedRewardRule.points_required ?? 0),
                  reward_delivery_type: typedRewardRule.reward_delivery_type ?? 'in_store',
                  requires_physical_presence: Boolean(typedRewardRule.requires_physical_presence),
                },
              } satisfies AvailableRewardItem
            })
            .filter((row): row is AvailableRewardItem => row !== null)

          // Caisse provider: only show rewards that explicitly require physical presence.
          setAvailableRewards(
            mappedRewards.filter(
              (reward) =>
                reward.reward_rule.reward_delivery_type !== 'digital_code' &&
                reward.reward_rule.requires_physical_presence,
            ),
          )
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message = caughtError instanceof Error ? caughtError.message : 'Impossible de charger les offres disponibles'
          setConsumeRewardError({ global: message })
          setAvailableRewards([])
        }
      } finally {
        if (!cancelled) {
          setRewardsLoading(false)
        }
      }
    }

    void loadPanelData()

    return () => {
      cancelled = true
    }
  }, [pendingTransaction.client_id, pendingTransaction.fournisseur_id])
  const displayError = consumeRewardError.global ?? null

  const handleConsumeReward = async (reward: AvailableRewardItem) => {
    if (consumingRewardId) {
      return
    }

    setConsumingRewardId(reward.id)
    setConsumeRewardSuccess(null)
    setConsumeRewardError((prev) => {
      const next = { ...prev }
      delete next[reward.id]
      return next
    })

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Session expirée. Reconnectez-vous pour consommer une récompense.')
      }

      const { error: unlockError } = await supabase.functions.invoke('unlock-reward', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          client_reward_id: reward.id,
          pending_transaction_id: pendingTransaction.id,
        },
      })

      if (unlockError) {
        throw new Error(unlockError.message)
      }

      setAvailableRewards((prev) => prev.filter((item) => item.id !== reward.id))
      setConsumeRewardSuccess('✅ Récompense consommée')
    } catch (caughtError) {
      const rawMessage = caughtError instanceof Error ? caughtError.message : 'Récompense impossible à consommer'
      const message =
        rawMessage.includes('Missing or invalid Authorization header') || rawMessage.includes('401')
          ? 'Session invalide. Veuillez vous reconnecter.'
          : rawMessage.includes('Forbidden')
            ? 'Accès refusé pour cette récompense.'
            : rawMessage.includes('INVALID_PENDING_TRANSACTION')
              ? 'Transaction invalide ou expirée. Relancez un scan QR.'
              : rawMessage
      setConsumeRewardError((prev) => ({
        ...prev,
        [reward.id]: message,
      }))
    } finally {
      setConsumingRewardId(null)
    }
  }

  return (
    <div className="space-y-4">
      {displayError ? (
        <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {displayError}
        </p>
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Offres débloquées
          </h3>
          {consumeRewardSuccess ? (
            <p className="text-xs font-medium text-emerald-400">{consumeRewardSuccess}</p>
          ) : null}
        </div>

        {rewardsLoading ? (
          <div className="flex min-h-20 items-center justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
          </div>
        ) : availableRewards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableRewards.map((reward) => {
              const isConsuming = consumingRewardId === reward.id
              const rewardError = consumeRewardError[reward.id] ?? null

              return (
                <div
                  key={reward.id}
                  className="rounded-xl border border-emerald-700 bg-emerald-900/20 px-4 py-3 text-emerald-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {reward.reward_rule.emoji} {reward.reward_rule.nom}
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">
                        {reward.reward_rule.points_required.toLocaleString('fr-FR')} pts
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleConsumeReward(reward)
                      }}
                      disabled={isConsuming}
                      className="shrink-0 inline-flex items-center justify-center rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isConsuming ? '...' : 'Consommer'}
                    </button>
                  </div>

                  {rewardError ? (
                    <p className="mt-2 text-xs text-red-300">{rewardError}</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Aucune offre débloquée à consommer pour ce client.</p>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
      >
        ← Retour au catalogue
      </button>
    </div>
  )
}