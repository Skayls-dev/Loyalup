import { useEffect, useMemo, useState } from 'react'
import type { PendingTransactionPayload } from '../../qr/services/qrService'
import type { Profile } from '../../../shared/types'
import { supabase } from '../../../shared/lib/supabaseClient'
import { useServices } from '../hooks/useServices'
import { useValidation } from '../hooks/useValidation'
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
  const [availableRewardsCount, setAvailableRewardsCount] = useState(0)
  const [showAllServices, setShowAllServices] = useState(false)

  const visibleServices = useMemo(() => {
    if (showAllServices) {
      return services
    }

    return services.slice(0, 3)
  }, [services, showAllServices])

  // Auto-select first non-custom service when services load
  useEffect(() => {
    if (validationMode !== 'service' || selectedService || servicesLoading || services.length === 0) return
    const first = services.find((s) => s.nom !== 'Personnalisé') ?? services[0]
    if (first) selectService(first)
  }, [services, servicesLoading, selectedService, selectService, validationMode])

  // Ensure selected service remains visible in collapsed mode
  useEffect(() => {
    if (!selectedService || showAllServices) return
    const isVisible = services.slice(0, 3).some((service) => service.id === selectedService.id)
    if (!isVisible) {
      setShowAllServices(true)
    }
  }, [selectedService, services, showAllServices])


  useEffect(() => {
    let cancelled = false

    const loadAvailableRewardsCount = async () => {
      const { data, error: availableRewardsError } = await supabase
        .from('client_rewards')
        .select('id, reward_rules(nom, reward_delivery_type, requires_physical_presence)')
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
        const eligibleCount = (data ?? []).filter((row) => {
          const raw = row.reward_rules as unknown
          const rule = Array.isArray(raw) ? raw[0] ?? null : raw
          if (!rule || typeof rule !== 'object') {
            return false
          }

          const typed = rule as {
            reward_delivery_type?: 'in_store' | 'digital_code' | null
            requires_physical_presence?: boolean | null
          }

          return typed.reward_delivery_type !== 'digital_code' && Boolean(typed.requires_physical_presence)
        }).length

        setAvailableRewardsCount(eligibleCount)
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

    setShowAllServices(false)

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

  const handleSuccessDismiss = () => {
    reset()
    setSuccessData(null)
    onDismiss()
  }

  return (
    <section className="relative w-full max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-zinc-100 shadow-2xl sm:p-4 md:p-5">
      <div className={`gap-4 ${validationMode === 'redemption' ? 'flex flex-col' : 'grid xl:grid-cols-2'}`}>
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

        {validationMode === 'redemption' ? (
          <RedemptionPanel
            pendingTransaction={pendingTransaction}
            clientProfile={clientProfile}
            clientPoints={clientPoints}
            totalVisites={totalVisites}
            onDismiss={onDismiss}
          />
        ) : (
          <>
            <div className="order-2 min-w-0 xl:order-3 xl:col-span-2">
              <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                {validationMode === 'service' ? (
                  servicesLoading ? (
                    <div className="flex min-h-32 items-center justify-center">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
                    </div>
                  ) : services.length > 0 ? (
                    <>
                      <ServiceSelector
                        services={visibleServices}
                        selectedService={selectedService}
                        onSelect={selectService}
                        density={services.length >= 6 ? 'dense' : ('normal' as const)}
                      />
                      {services.length > 2 ? (
                        <p className="mt-2 text-xs text-zinc-500">Faites glisser horizontalement pour voir les autres services.</p>
                      ) : null}
                      {services.length > 3 ? (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setShowAllServices((prev) => !prev)}
                            className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                          >
                            {showAllServices ? 'Réduire la liste' : `Afficher tout (${services.length})`}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="py-4 text-center text-sm text-zinc-400">Aucun service configuré. Utilisez le montant libre.</p>
                  )
                ) : (
                  <div>
                    <label htmlFor="custom-service-name" className="mb-2 block text-sm font-medium text-zinc-300">
                      Nom du service (optionnel)
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
                )}

                <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
                  {validationMode !== 'amount' ? (
                    <button
                      type="button"
                      onClick={() => handleModeChange('amount')}
                      className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-amber-500/50 hover:text-amber-300"
                    >
                      Montant libre
                    </button>
                  ) : services.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleModeChange('service')}
                      className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                    >
                      ← Retour catalogue
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleModeChange('redemption')}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      availableRewardsCount > 0
                        ? 'border-teal-500/40 bg-teal-500/10 text-teal-300 hover:border-teal-400 hover:text-teal-200'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    🎁 Offres disponibles ({availableRewardsCount})
                  </button>
                </div>
              </div>
            </div>

            <div className="order-3 min-w-0 xl:order-2">
              <PriceInput
                montant={montant}
                onMontantChange={setMontant}
                pointsPreview={pointsPreview}
                selectedService={selectedService}
              />
            </div>
          </>
        )}
      </div>

      {validationMode !== 'redemption' ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
