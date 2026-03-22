import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { PendingTransactionPayload } from '../../qr/services/qrService'
import type { Profile } from '../../../shared/types'
import { supabase } from '../../../shared/lib/supabaseClient'
import { useRedemption } from '../hooks/useRedemption'
import { ClientPreview } from './ClientPreview'
import {
  fetchRedemptionRules,
  type RedeemPointsResponse,
  type RedemptionRule,
} from '../services/redemptionService'

type RedemptionPanelProps = {
  pendingTransaction: PendingTransactionPayload
  clientProfile: Profile | null
  clientPoints: number
  onDismiss: () => void
}

type RedemptionSuccessProps = {
  clientName: string
  pointsDeducted: number
  discountApplied: number
  newBalance: number
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
  }
}

function RedemptionSuccess({
  clientName,
  pointsDeducted,
  discountApplied,
  newBalance,
  onDismiss,
}: RedemptionSuccessProps) {
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      onDismiss()
    }, 3000)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [onDismiss])

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/95 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100 shadow-2xl">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            aria-label="Fermer le panneau de redemption"
          >
            Fermer
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="animate-[scaleIn_320ms_ease-out] rounded-full bg-emerald-500/15 p-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-400" />
          </div>

          <h3 className="mt-4 text-2xl font-bold">Reduction appliquee</h3>
          <p className="mt-1 text-sm text-zinc-400">{clientName}</p>

          <div className="mt-5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left">
            <p className="text-sm text-zinc-400">Points utilises</p>
            <p className="font-semibold">-{pointsDeducted.toLocaleString('fr-FR')} pts</p>

            <p className="mt-3 text-sm text-zinc-400">Reduction appliquee</p>
            <p className="font-semibold">{discountApplied.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</p>

            <p className="mt-3 text-sm text-zinc-400">Nouveau solde</p>
            <p className="font-semibold">{newBalance.toLocaleString('fr-FR')} pts</p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Retour
          </button>
        </div>
      </div>
    </div>
  )
}

function formatRuleDiscount(rule: RedemptionRule): string {
  if (rule.discount_type === 'fixed') {
    return `${rule.discount_value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
  }

  if (rule.max_discount_eur != null) {
    return `${rule.discount_value.toLocaleString('fr-FR')}% (max ${rule.max_discount_eur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR)`
  }

  return `${rule.discount_value.toLocaleString('fr-FR')}%`
}

export function RedemptionPanel({
  pendingTransaction,
  clientProfile,
  clientPoints,
  onDismiss,
}: RedemptionPanelProps) {
  const {
    selectedRule,
    customPoints,
    pointsToRedeem,
    discountPreview,
    isSubmitting,
    isSuccess,
    error,
    canRedeem,
    selectRule,
    clearRule,
    setCustomPoints,
    redeem,
    reset,
  } = useRedemption({ clientSolde: clientPoints })

  const [rules, setRules] = useState<RedemptionRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [availableRewards, setAvailableRewards] = useState<AvailableRewardItem[]>([])
  const [rewardsLoading, setRewardsLoading] = useState(false)
  const [consumingRewardId, setConsumingRewardId] = useState<string | null>(null)
  const [consumeRewardError, setConsumeRewardError] = useState<Record<string, string>>({})
  const [consumeRewardSuccess, setConsumeRewardSuccess] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<RedeemPointsResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadPanelData = async () => {
      setRulesLoading(true)
      setRewardsLoading(true)
      setRulesError(null)
      setConsumeRewardSuccess(null)

      try {
        const [rulesResult, availableRewardsResult] = await Promise.all([
          fetchRedemptionRules(pendingTransaction.fournisseur_id),
          supabase
            .from('client_rewards')
            .select('id, reward_rule_id, unlocked_at, reward_rules(nom, emoji, points_required, reward_delivery_type)')
            .eq('client_id', pendingTransaction.client_id)
            .eq('fournisseur_id', pendingTransaction.fournisseur_id)
            .eq('status', 'available'),
        ])

        if (!cancelled) {
          setRules(rulesResult)

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
                },
              } satisfies AvailableRewardItem
            })
            .filter((row): row is AvailableRewardItem => row !== null)

          // TODO V2: digital_code rewards (reward_delivery_type === 'digital_code') are not shown here.
          // They are self-served by the client and do not require merchant action.
          // Filter: only show rewards where reward_rule.reward_delivery_type === 'in_store' (or undefined).
          setAvailableRewards(
            mappedRewards.filter((reward) => reward.reward_rule.reward_delivery_type !== 'digital_code'),
          )
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message = caughtError instanceof Error ? caughtError.message : 'Impossible de charger les regles de redemption'
          setRulesError(message)
          setAvailableRewards([])
        }
      } finally {
        if (!cancelled) {
          setRulesLoading(false)
          setRewardsLoading(false)
        }
      }
    }

    void loadPanelData()

    return () => {
      cancelled = true
    }
  }, [pendingTransaction.client_id, pendingTransaction.fournisseur_id])

  const pointsAfterPreview = useMemo(() => clientPoints - pointsToRedeem, [clientPoints, pointsToRedeem])

  const discountText = useMemo(
    () => discountPreview.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [discountPreview],
  )

  const hasRules = rules.length > 0
  const displayError = error ?? rulesError

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
      const { error: unlockError } = await supabase.functions.invoke('unlock-reward', {
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
      const message = caughtError instanceof Error ? caughtError.message : 'Récompense impossible à consommer'
      setConsumeRewardError((prev) => ({
        ...prev,
        [reward.id]: message,
      }))
    } finally {
      setConsumingRewardId(null)
    }
  }

  const handleRedeem = async () => {
    try {
      const result = await redeem(pendingTransaction.id)
      setSuccessData(result)
    } catch {
      return
    }
  }

  const handleSuccessDismiss = () => {
    reset()
    setSuccessData(null)
    onDismiss()
  }

  return (
    <section className="relative w-full max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100 shadow-2xl md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <ClientPreview
            clientProfile={clientProfile}
            clientPoints={clientPoints}
            totalVisites={0}
            pendingTransaction={pendingTransaction}
          />

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm uppercase tracking-wide text-zinc-400">Solde actuel</p>
            <p className="mt-2 font-display text-4xl font-bold" style={{ color: '#5B4FE8' }}>
              {clientPoints.toLocaleString('fr-FR')} pts
            </p>

            <p className="mt-4 text-sm uppercase tracking-wide text-zinc-400">Apres redemption</p>
            <p className={`mt-2 text-2xl font-bold ${pointsAfterPreview < 0 ? 'text-red-400' : 'text-zinc-100'}`}>
              {pointsAfterPreview.toLocaleString('fr-FR')} pts
            </p>
          </div>

          {displayError ? (
            <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {displayError}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Récompenses débloquées
            </h3>

            {rewardsLoading ? (
              <div className="flex min-h-20 items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
              </div>
            ) : availableRewards.length > 0 ? (
              <div className="space-y-3">
                {consumeRewardSuccess ? (
                  <p className="rounded-lg border border-emerald-700 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-300">
                    {consumeRewardSuccess}
                  </p>
                ) : null}

                {availableRewards.map((reward) => {
                  const isConsuming = consumingRewardId === reward.id
                  const rewardError = consumeRewardError[reward.id] ?? null

                  return (
                    <div
                      key={reward.id}
                      className="rounded-xl border border-emerald-700 bg-emerald-900/20 px-4 py-3 text-emerald-100"
                    >
                      <div className="flex items-start justify-between gap-3">
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
                          className="inline-flex items-center justify-center rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isConsuming ? 'Consommation...' : 'Consommer'}
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
              <p className="text-sm text-zinc-400">Aucune récompense débloquée à consommer pour ce client.</p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Reduction par points
            </h3>

            {rulesLoading ? (
              <div className="flex min-h-20 items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
              </div>
            ) : hasRules ? (
              <div className="space-y-3">
                <div className="grid gap-2">
                  {rules.map((rule) => {
                    const selected = selectedRule?.id === rule.id

                    return (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => selectRule(rule)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          selected
                            ? 'border-teal-400 bg-teal-500/10 text-teal-300'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'
                        }`}
                      >
                        <p className="text-sm font-semibold">{rule.label}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {rule.points_cost.toLocaleString('fr-FR')} pts - {formatRuleDiscount(rule)}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {selectedRule ? (
                  <button
                    type="button"
                    onClick={clearRule}
                    className="text-xs font-semibold text-zinc-400 transition hover:text-zinc-200"
                  >
                    Effacer la regle selectionnee
                  </button>
                ) : null}
              </div>
            ) : (
              <div>
                <label htmlFor="custom-points" className="mb-2 block text-sm font-medium text-zinc-300">
                  Points a utiliser
                </label>

                <div className="relative">
                  <input
                    id="custom-points"
                    type="text"
                    inputMode="numeric"
                    value={customPoints}
                    onChange={(event) => setCustomPoints(event.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 pr-14 text-2xl font-semibold text-zinc-100 outline-none transition focus:border-teal-400"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    pts
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Preview reduction</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">= {discountText}EUR de reduction</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 md:flex-row">
            <button
              type="button"
              onClick={onDismiss}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                void handleRedeem()
              }}
              disabled={!canRedeem || isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Application...' : 'Appliquer la reduction'}
            </button>
          </div>
        </div>
      </div>

      {isSuccess && successData ? (
        <RedemptionSuccess
          clientName={clientProfile?.nom || 'Client inconnu'}
          pointsDeducted={successData.points_deducted}
          discountApplied={successData.discount_applied}
          newBalance={successData.new_balance}
          onDismiss={handleSuccessDismiss}
        />
      ) : null}
    </section>
  )
}