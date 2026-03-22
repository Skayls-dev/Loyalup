import { useEffect, useMemo, useState } from 'react'
import { Gift } from 'lucide-react'
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

  // Auto-select first non-custom service when services load
  useEffect(() => {
    if (validationMode !== 'service' || selectedService || servicesLoading || services.length === 0) return
    const first = services.find((s) => s.nom !== 'Personnalisé') ?? services[0]
    if (first) selectService(first)
  }, [services, servicesLoading, selectedService, selectService, validationMode])

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

  const handleSuccessDismiss = () => {
    reset()
    setSuccessData(null)
    onDismiss()
  }

  return (
    <section className="relative w-full max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-zinc-100 shadow-2xl sm:p-4 md:p-5">
      <div className="grid gap-4 xl:grid-cols-2">
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

        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Mode de validation
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              <button
                type="button"
                onClick={() => handleModeChange('service')}
                className={`min-h-[124px] rounded-xl border px-4 py-3 text-left transition ${
                  validationMode === 'service'
                    ? 'border-teal-400 bg-teal-500/10 text-teal-300'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <p className="text-sm font-semibold leading-tight">Par service</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">Choisir un produit ou une prestation</p>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('amount')}
                className={`min-h-[124px] rounded-xl border px-4 py-3 text-left transition ${
                  validationMode === 'amount'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <p className="text-sm font-semibold leading-tight">Montant libre</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">Saisir directement le prix de l'achat</p>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('redemption')}
                className={`min-h-[124px] rounded-xl border px-4 py-3 text-left transition ${
                  validationMode === 'redemption'
                    ? 'border-teal-400 bg-teal-500/10 text-teal-300'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  <p className="text-sm font-semibold leading-tight">Offres disponibles</p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">Consommer une récompense déjà débloquée</p>
              </button>
            </div>
          </div>

          {validationMode === 'redemption' ? (
            <RedemptionPanel
              pendingTransaction={pendingTransaction}
              clientProfile={clientProfile}
              clientPoints={clientPoints}
              totalVisites={totalVisites}
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

        </div>
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
