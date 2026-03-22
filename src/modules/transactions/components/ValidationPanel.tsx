import { useEffect, useMemo, useState } from 'react'
import { Gift } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PendingTransactionPayload } from '../../qr/services/qrService'
import type { Profile } from '../../../shared/types'
import { supabase } from '../../../shared/lib/supabaseClient'
import { useServices } from '../hooks/useServices'
import { useValidation } from '../hooks/useValidation'
import { fetchRedemptionRules, redeemPoints, type RedemptionRule } from '../services/redemptionService'
import { ClientPreview } from './ClientPreview'
import { PriceInput } from './PriceInput'
import { RedemptionPanel } from './RedemptionPanel'
import { ServiceSelector } from './ServiceSelector'
import { TransactionSuccess } from './TransactionSuccess'

type ValidationMode = 'service' | 'amount' | 'redemption'

type ValidationPanelProps = {
  pendingTransaction: PendingTransactionPayload
  clientProfile: Profile | null
  clientPoints: number
  totalVisites?: number
  onDismiss: () => void
}

export function ValidationPanel({
  pendingTransaction,
  clientProfile,
  clientPoints,
  totalVisites = 0,
  onDismiss,
}: ValidationPanelProps) {
  const { services, loading: servicesLoading, error: servicesError } = useServices(
    pendingTransaction.fournisseur_id,
  )
  const {
    selectedService,
    montant,
    pointsPreview,
    isSubmitting,
    isSuccess,
    error,
    canValidate,
    selectService,
    clearSelectedService,
    setMontant,
    validate,
    cancel,
    reset,
  } = useValidation()
  const [validationMode, setValidationMode] = useState<ValidationMode>('service')
  const [customServiceName, setCustomServiceName] = useState('')
  const [redemptionRules, setRedemptionRules] = useState<RedemptionRule[]>([])
  const [redemptionRulesLoading, setRedemptionRulesLoading] = useState(false)
  const [redemptionPoints, setRedemptionPoints] = useState('')
  const [selectedRedemptionRuleId, setSelectedRedemptionRuleId] = useState('')
  const [redemptionSubmitting, setRedemptionSubmitting] = useState(false)
  const [redemptionError, setRedemptionError] = useState<string | null>(null)
  const [availableRewardsCount, setAvailableRewardsCount] = useState(0)
  const [redemptionSuccess, setRedemptionSuccess] = useState<{
    pointsDeducted: number
    discountApplied: number
    newBalance: number
  } | null>(null)

  // Auto-select first non-custom service when services load
  useEffect(() => {
    if (validationMode !== 'service' || selectedService || servicesLoading || services.length === 0) return
    const first = services.find((s) => s.nom !== 'Personnalisé') ?? services[0]
    if (first) selectService(first)
  }, [services, servicesLoading, selectedService, selectService, validationMode])

  useEffect(() => {
    let cancelled = false

    const loadRules = async () => {
      setRedemptionRulesLoading(true)
      setRedemptionError(null)

      try {
        const rules = await fetchRedemptionRules(pendingTransaction.fournisseur_id)
        if (!cancelled) {
          setRedemptionRules(rules)
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message = caughtError instanceof Error ? caughtError.message : 'Impossible de charger les règles de redemption'
          setRedemptionError(message)
        }
      } finally {
        if (!cancelled) {
          setRedemptionRulesLoading(false)
        }
      }
    }

    void loadRules()

    return () => {
      cancelled = true
    }
  }, [pendingTransaction.fournisseur_id])

  useEffect(() => {
    let cancelled = false

    const loadAvailableRewardsCount = async () => {
      const { count, error: availableRewardsError } = await supabase
        .from('client_rewards')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', pendingTransaction.client_id)
        .eq('fournisseur_id', pendingTransaction.fournisseur_id)
        .eq('status', 'available')

      if (availableRewardsError) {
        if (!cancelled) {
          setAvailableRewardsCount(0)
        }
        return
      }

      if (!cancelled) {
        setAvailableRewardsCount(Number(count ?? 0))
      }
    }

    void loadAvailableRewardsCount()

    return () => {
      cancelled = true
    }
  }, [pendingTransaction.client_id, pendingTransaction.fournisseur_id])

  const [successData, setSuccessData] = useState<{
    serviceName: string
    montant: number
    basePoints: number
    pointsCredited: number
    newBalance: number
    networkBonuses: Array<{ network_name: string; emoji: string; bonus: number }>
  } | null>(null)

  const displayError = error ?? servicesError

  const selectedServiceName = useMemo(() => {
    if (validationMode === 'amount') {
      const trimmed = customServiceName.trim()
      return trimmed || 'Achat libre'
    }

    if (selectedService) {
      return selectedService.nom
    }

    return 'Personnalisé'
  }, [selectedService, validationMode, customServiceName])

  const handleModeChange = (mode: ValidationMode) => {
    setValidationMode(mode)

    if (mode === 'amount') {
      clearSelectedService()
      return
    }

    if (mode === 'redemption') {
      clearSelectedService()
      return
    }

    const first = services.find((service) => service.nom !== 'Personnalisé') ?? services[0] ?? null
    if (first) {
      selectService(first)
    }
  }

  const handleValidate = async () => {
    try {
      const freeLabel = validationMode === 'amount' ? customServiceName.trim() || undefined : undefined
      const response = await validate(pendingTransaction.id, freeLabel)
      const amount = Number.parseFloat(montant || '0')

      setSuccessData({
        serviceName: selectedServiceName,
        montant: Number.isFinite(amount) ? amount : 0,
        basePoints: response.base_points ?? response.points_credited,
        pointsCredited: response.points_credited,
        newBalance: response.new_balance,
        networkBonuses: response.network_bonuses ?? [],
      })
    } catch {
      return
    }
  }

  const handleCancel = async () => {
    try {
      await cancel(pendingTransaction.id)
      onDismiss()
    } catch {
      return
    }
  }

  const parsedRedemptionPoints = Number.parseInt(redemptionPoints, 10)
  const canRedeem = Number.isInteger(parsedRedemptionPoints) && parsedRedemptionPoints > 0

  const selectedRule = redemptionRules.find((rule) => rule.id === selectedRedemptionRuleId) ?? null
  const redemptionRulesConfigPath = '/merchant/offers#redemption-rules'

  const handleRedeem = async () => {
    if (!canRedeem || redemptionSubmitting) {
      return
    }

    setRedemptionSubmitting(true)
    setRedemptionError(null)
    setRedemptionSuccess(null)

    try {
      const result = await redeemPoints({
        pending_transaction_id: pendingTransaction.id,
        points_to_redeem: parsedRedemptionPoints,
        redemption_rule_id: selectedRedemptionRuleId || undefined,
      })

      setRedemptionSuccess({
        pointsDeducted: result.points_deducted,
        discountApplied: result.discount_applied,
        newBalance: result.new_balance,
      })
      setRedemptionPoints('')
      setSelectedRedemptionRuleId('')
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Réduction impossible'
      setRedemptionError(message)
    } finally {
      setRedemptionSubmitting(false)
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
            totalVisites={totalVisites}
            pendingTransaction={pendingTransaction}
            availableRewardsCount={availableRewardsCount}
          />

          {displayError ? (
            <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {displayError}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Mode de validation
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleModeChange('service')}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  validationMode === 'service'
                    ? 'border-teal-400 bg-teal-500/10 text-teal-300'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <p className="text-sm font-semibold">Par service</p>
                <p className="mt-1 text-xs text-zinc-400">Choisir un produit ou une prestation</p>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('amount')}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  validationMode === 'amount'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <p className="text-sm font-semibold">Montant libre</p>
                <p className="mt-1 text-xs text-zinc-400">Saisir directement le prix de l'achat</p>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('redemption')}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  validationMode === 'redemption'
                    ? 'border-teal-400 bg-teal-500/10 text-teal-300'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  <p className="text-sm font-semibold">Rédemption points</p>
                </div>
                <p className="mt-1 text-xs text-zinc-400">Appliquer une réduction avec les points</p>
              </button>
            </div>
          </div>

          {validationMode === 'redemption' ? (
            <RedemptionPanel
              pendingTransaction={pendingTransaction}
              clientProfile={clientProfile}
              clientPoints={clientPoints}
              onDismiss={onDismiss}
            />
          ) : null}

          {validationMode === 'service' ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Choisir un service
              </h3>
              {servicesLoading ? (
                <div className="flex min-h-32 items-center justify-center">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
                </div>
              ) : (
                <ServiceSelector
                  services={services}
                  selectedService={selectedService}
                  onSelect={selectService}
                />
              )}
            </div>
          ) : null}

          {validationMode === 'amount' ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <label htmlFor="custom-service-name" className="mb-2 block text-sm font-medium text-zinc-300">
                Nom du service
              </label>
              <input
                id="custom-service-name"
                type="text"
                value={customServiceName}
                onChange={(event) => setCustomServiceName(event.target.value)}
                placeholder="Ex: Achat boutique"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
              />
            </div>
          ) : null}

          {validationMode !== 'redemption' ? (
            <PriceInput
              montant={montant}
              onMontantChange={setMontant}
              pointsPreview={pointsPreview}
              selectedService={selectedService}
            />
          ) : null}

          {validationMode !== 'redemption' ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Réduction par points
            </h3>
            <p className="mb-2 text-xs text-zinc-500">
              Cette section applique une remise en caisse avec les points du client.
            </p>
            <p className="mb-3 text-xs text-zinc-500">
              Configuration : <Link to={redemptionRulesConfigPath} className="text-teal-300 underline hover:text-teal-200">Redemption rules marchand</Link> pour les regles et le taux de conversion points/euro.
            </p>

            {redemptionRulesLoading ? (
              <div className="mb-3 flex min-h-10 items-center">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
              </div>
            ) : (
              <div className="mb-3 space-y-2">
                <label className="block text-xs text-zinc-400">Règle (optionnelle)</label>
                <select
                  value={selectedRedemptionRuleId}
                  onChange={(event) => setSelectedRedemptionRuleId(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-teal-400"
                >
                  <option value="">Aucune règle (conversion fournisseur)</option>
                  {redemptionRules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.label} - {rule.points_cost} pts
                    </option>
                  ))}
                </select>
                {selectedRule ? (
                  <p className="text-xs text-zinc-500">
                    {selectedRule.discount_type === 'fixed'
                      ? `Fixe: ${selectedRule.discount_value.toLocaleString('fr-FR')} EUR`
                      : `Pourcentage: ${selectedRule.discount_value.toLocaleString('fr-FR')}%${selectedRule.max_discount_eur != null ? ` (max ${selectedRule.max_discount_eur.toLocaleString('fr-FR')} EUR)` : ''}`}
                  </p>
                ) : null}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="redeem-points" className="block text-xs text-zinc-400">Points à utiliser</label>
              <input
                id="redeem-points"
                type="number"
                min={1}
                value={redemptionPoints}
                onChange={(event) => setRedemptionPoints(event.target.value.replace(/[^0-9]/g, ''))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-teal-400"
                placeholder="Ex: 100"
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-500">Solde client actuel: {clientPoints.toLocaleString('fr-FR')} pts</p>
              <button
                type="button"
                onClick={() => {
                  void handleRedeem()
                }}
                disabled={!canRedeem || redemptionSubmitting}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {redemptionSubmitting ? 'Application...' : 'Appliquer réduction'}
              </button>
            </div>

            {redemptionError ? (
              <p className="mt-2 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">
                {redemptionError}
              </p>
            ) : null}

            {redemptionSuccess ? (
              <p className="mt-2 rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
                Réduction appliquée: -{redemptionSuccess.pointsDeducted.toLocaleString('fr-FR')} pts, remise {redemptionSuccess.discountApplied.toLocaleString('fr-FR')} EUR, nouveau solde {redemptionSuccess.newBalance.toLocaleString('fr-FR')} pts.
              </p>
            ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {validationMode !== 'redemption' ? (
        <div className="mt-5 flex flex-col gap-2 md:flex-row">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ✗ Annuler
        </button>
        <button
          type="button"
          onClick={handleValidate}
          disabled={!canValidate || isSubmitting || (validationMode === 'service' && servicesLoading)}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ✓ Valider
        </button>
        </div>
      ) : null}

      {isSuccess && successData ? (
        <TransactionSuccess
          clientName={clientProfile?.nom || 'Client inconnu'}
          serviceName={successData.serviceName}
          montant={successData.montant}
          basePoints={successData.basePoints}
          pointsCredited={successData.pointsCredited}
          newBalance={successData.newBalance}
          networkBonuses={successData.networkBonuses}
          onDismiss={handleSuccessDismiss}
        />
      ) : null}
    </section>
  )
}
