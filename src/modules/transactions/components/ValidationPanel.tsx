import { useEffect, useMemo, useState } from 'react'
import type { PendingTransactionPayload } from '../../qr/services/qrService'
import type { Profile } from '../../../shared/types'
import { supabase } from '../../../shared/lib/supabaseClient'
import { config } from '../../../shared/lib/env'
import { useServices } from '../hooks/useServices'
import { useValidation } from '../hooks/useValidation'
import { ClientPreview } from './ClientPreview'
import { PriceInput } from './PriceInput'
import { RedemptionPanel } from './RedemptionPanel'
import { TransactionSuccess } from './TransactionSuccess'

type ValidationMode = 'service' | 'amount' | 'redemption'

type SumUpRecentTransaction = {
  id: string | null
  transaction_code: string | null
  timestamp: string | null
  amount: number | null
  currency: string | null
  status: string | null
  payment_type: string | null
}

type SumUpRecentTransactionsResponse = {
  connected: boolean
  reason: string | null
  lookback_minutes?: number
  applied_limit?: number
  items: SumUpRecentTransaction[]
  recommended?: SumUpRecentTransaction | null
}

const MANUAL_PAGE_SIZE = 5
const SUMUP_TRANSACTIONS_PAGE_SIZE = 5
const PRODUCT_CATALOG_PAGE_SIZE = 5

function transactionSelectionKey(item: SumUpRecentTransaction, index: number): string {
  return item.id ?? item.transaction_code ?? `index-${index}`
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 10
  return Math.min(50, Math.max(1, Math.floor(value)))
}

async function getAccessTokenOrThrow(forceRefresh = false): Promise<string> {
  const isTokenAboutToExpire = (token: string, bufferSeconds = 60): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number }
      const exp = typeof payload.exp === 'number' ? payload.exp : 0
      return exp - Math.floor(Date.now() / 1000) < bufferSeconds
    } catch {
      return true
    }
  }

  const isLikelyJwt = (token: string): boolean => /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(token)

  if (forceRefresh) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    const refreshedToken = refreshed.session?.access_token
    if (refreshedToken && isLikelyJwt(refreshedToken) && !isTokenAboutToExpire(refreshedToken)) {
      return refreshedToken
    }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const cachedToken = sessionData.session?.access_token
  if (cachedToken && isLikelyJwt(cachedToken) && !isTokenAboutToExpire(cachedToken)) {
    return cachedToken
  }

  const { data: refreshed } = await supabase.auth.refreshSession()
  const token = refreshed.session?.access_token
  if (!token || !isLikelyJwt(token) || isTokenAboutToExpire(token)) {
    throw new Error('Session expirée, veuillez vous reconnecter')
  }

  return token
}

function formatRecentTimestamp(value: string | null): string {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

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
    clearSelectedService,
    setMontant,
    validate,
    cancel,
    reset,
  } = useValidation()
  const [validationMode, setValidationMode] = useState<ValidationMode>('service')
  const [customServiceName, setCustomServiceName] = useState('')
  const [availableRewardsCount, setAvailableRewardsCount] = useState(0)
  const [isSumUpLoading, setIsSumUpLoading] = useState(false)
  const [sumUpConnected, setSumUpConnected] = useState(false)
  const [sumUpLookbackMinutes, setSumUpLookbackMinutes] = useState(30)
  const [sumUpFetchLimit, setSumUpFetchLimit] = useState(() => {
    if (typeof window === 'undefined') return 10
    const stored = window.localStorage.getItem(`looyaal:sumup-recent-limit:${pendingTransaction.fournisseur_id}`)
    return clampLimit(Number(stored ?? 10))
  })
  const [sumUpRecentTransactions, setSumUpRecentTransactions] = useState<SumUpRecentTransaction[]>([])
  const [selectedSumUpTransactionKeys, setSelectedSumUpTransactionKeys] = useState<string[]>([])
  const [productLinkingMode, setProductLinkingMode] = useState<'catalog' | 'free-text'>('catalog')
  const [selectedProductServiceIds, setSelectedProductServiceIds] = useState<string[]>([])
  const [productLinkingLabel, setProductLinkingLabel] = useState('')
  const [paymentChannel, setPaymentChannel] = useState<'sumup' | 'manual'>('manual')
  const [selectedManualServiceIds, setSelectedManualServiceIds] = useState<string[]>([])
  const [manualServiceSearch, setManualServiceSearch] = useState('')
  const [productServiceSearch, setProductServiceSearch] = useState('')
  const [manualPage, setManualPage] = useState(1)
  const [sumUpTransactionsPage, setSumUpTransactionsPage] = useState(1)
  const [productCatalogPage, setProductCatalogPage] = useState(1)

  const filteredManualServices = useMemo(() => {
    const query = manualServiceSearch.trim().toLowerCase()
    if (!query) return services
    return services.filter((service) => service.nom.toLowerCase().includes(query))
  }, [manualServiceSearch, services])

  const linkableServices = useMemo(
    () => services.filter((service) => service.prix_defaut && service.prix_defaut > 0),
    [services],
  )

  const filteredLinkableServices = useMemo(() => {
    const query = productServiceSearch.trim().toLowerCase()
    if (!query) return linkableServices
    return linkableServices.filter((service) => service.nom.toLowerCase().includes(query))
  }, [productServiceSearch, linkableServices])

  const manualTotalPages = Math.max(1, Math.ceil(filteredManualServices.length / MANUAL_PAGE_SIZE))
  const visibleServices = useMemo(() => {
    const start = (manualPage - 1) * MANUAL_PAGE_SIZE
    return filteredManualServices.slice(start, start + MANUAL_PAGE_SIZE)
  }, [filteredManualServices, manualPage])

  const sumUpTotalPages = Math.max(1, Math.ceil(sumUpRecentTransactions.length / SUMUP_TRANSACTIONS_PAGE_SIZE))
  const visibleSumUpTransactions = useMemo(() => {
    const start = (sumUpTransactionsPage - 1) * SUMUP_TRANSACTIONS_PAGE_SIZE
    return sumUpRecentTransactions.slice(start, start + SUMUP_TRANSACTIONS_PAGE_SIZE).map((item, localIndex) => ({
      item,
      absoluteIndex: start + localIndex,
    }))
  }, [sumUpRecentTransactions, sumUpTransactionsPage])

  const productCatalogTotalPages = Math.max(1, Math.ceil(filteredLinkableServices.length / PRODUCT_CATALOG_PAGE_SIZE))
  const visibleProductServices = useMemo(() => {
    const start = (productCatalogPage - 1) * PRODUCT_CATALOG_PAGE_SIZE
    return filteredLinkableServices.slice(start, start + PRODUCT_CATALOG_PAGE_SIZE)
  }, [filteredLinkableServices, productCatalogPage])

  const selectedManualServicesTotal = useMemo(() => {
    if (selectedManualServiceIds.length === 0) return 0

    let total = 0
    selectedManualServiceIds.forEach((serviceId) => {
      const service = services.find((item) => item.id === serviceId)
      if (service?.prix_defaut && service.prix_defaut > 0) {
        total += service.prix_defaut
      }
    })

    return Number(total.toFixed(2))
  }, [selectedManualServiceIds, services])

  useEffect(() => {
    setManualPage(1)
  }, [manualServiceSearch])

  useEffect(() => {
    setSumUpTransactionsPage(1)
  }, [sumUpRecentTransactions])

  useEffect(() => {
    setProductCatalogPage(1)
  }, [productServiceSearch, productLinkingMode])

  useEffect(() => {
    setManualPage((previous) => Math.min(previous, manualTotalPages))
  }, [manualTotalPages])

  useEffect(() => {
    setSumUpTransactionsPage((previous) => Math.min(previous, sumUpTotalPages))
  }, [sumUpTotalPages])

  useEffect(() => {
    setProductCatalogPage((previous) => Math.min(previous, productCatalogTotalPages))
  }, [productCatalogTotalPages])

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

          return typed.reward_delivery_type !== 'digital_code'
        }).length

        setAvailableRewardsCount(eligibleCount)
      }
    }

    void loadAvailableRewardsCount()

    return () => {
      cancelled = true
    }
  }, [pendingTransaction.client_id, pendingTransaction.fournisseur_id])

  useEffect(() => {
    let cancelled = false

    const loadSumUpRecentTransactions = async () => {
      setIsSumUpLoading(true)

      try {
        const callRecentTransactions = async (token: string) => fetch(`${config.supabaseUrl}/functions/v1/sumup-recent-transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            authorization: `Bearer ${token}`,
            apikey: config.supabaseAnonKey,
          },
          body: JSON.stringify({
            pending_transaction_id: pendingTransaction.id,
            limit: sumUpFetchLimit,
            access_token: token,
          }),
        })

        let token = await getAccessTokenOrThrow(false)
        let response = await callRecentTransactions(token)

        if (response.status === 401) {
          token = await getAccessTokenOrThrow(true)
          response = await callRecentTransactions(token)
        }

        if (!response.ok) {
          throw new Error(`sumup-recent-transactions failed (${response.status})`)
        }

        const payload = await response.json() as SumUpRecentTransactionsResponse
        if (cancelled) return

        const recentItems = Array.isArray(payload.items) ? payload.items : []
        const suggested = payload.recommended && typeof payload.recommended.amount === 'number'
          ? payload.recommended
          : recentItems.find((item) => typeof item.amount === 'number' && item.amount > 0) ?? null

        setSumUpConnected(Boolean(payload.connected))
        setSumUpLookbackMinutes(Number(payload.lookback_minutes ?? 30))
        setSumUpRecentTransactions(recentItems)
        setSumUpFetchLimit(clampLimit(Number(payload.applied_limit ?? sumUpFetchLimit)))

        if (!payload.connected) {
          setSelectedSumUpTransactionKeys([])
          return
        }

        const availableKeys = recentItems.map((item, index) => transactionSelectionKey(item, index))

        setSelectedSumUpTransactionKeys((previous) => {
          const preserved = previous.filter((key) => availableKeys.includes(key))
          if (preserved.length > 0) return preserved

          const suggestedIndex = suggested
            ? recentItems.findIndex((item) => (
              (suggested.id && item.id === suggested.id)
              || (suggested.transaction_code && item.transaction_code === suggested.transaction_code)
            ))
            : -1

          if (suggestedIndex >= 0) {
            return [transactionSelectionKey(recentItems[suggestedIndex], suggestedIndex)]
          }

          return []
        })
      } catch {
        if (!cancelled) {
          setSumUpConnected(false)
          setSumUpRecentTransactions([])
          setSelectedSumUpTransactionKeys([])
        }
      } finally {
        if (!cancelled) {
          setIsSumUpLoading(false)
        }
      }
    }

    void loadSumUpRecentTransactions()

    return () => {
      cancelled = true
    }
  }, [pendingTransaction.id, sumUpFetchLimit])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      `looyaal:sumup-recent-limit:${pendingTransaction.fournisseur_id}`,
      String(sumUpFetchLimit),
    )
  }, [pendingTransaction.fournisseur_id, sumUpFetchLimit])

  const selectedSumUpTotal = useMemo(() => {
    if (!sumUpConnected || selectedSumUpTransactionKeys.length === 0) return 0

    let total = 0
    sumUpRecentTransactions.forEach((item, index) => {
      const key = transactionSelectionKey(item, index)
      if (!selectedSumUpTransactionKeys.includes(key)) return
      if (typeof item.amount !== 'number' || item.amount <= 0) return
      total += item.amount
    })

    return Number(total.toFixed(2))
  }, [sumUpConnected, selectedSumUpTransactionKeys, sumUpRecentTransactions])

  const selectedProductServicesTotal = useMemo(() => {
    if (productLinkingMode !== 'catalog' || selectedProductServiceIds.length === 0) return 0

    let total = 0
    selectedProductServiceIds.forEach((serviceId) => {
      const service = services.find((s) => s.id === serviceId)
      if (service?.prix_defaut && typeof service.prix_defaut === 'number' && service.prix_defaut > 0) {
        total += service.prix_defaut
      }
    })

    return Number(total.toFixed(2))
  }, [productLinkingMode, selectedProductServiceIds, services])

  const productLinkingValidation = useMemo(() => {
    if (selectedSumUpTotal <= 0) return null

    if (productLinkingMode === 'catalog') {
      return {
        isValid: selectedProductServicesTotal === selectedSumUpTotal,
        total: selectedProductServicesTotal,
        target: selectedSumUpTotal,
      }
    }

    // Free-text mode: always valid if a label exists
    return {
      isValid: Boolean(productLinkingLabel.trim()),
      total: selectedSumUpTotal,
      target: selectedSumUpTotal,
    }
  }, [productLinkingMode, selectedProductServicesTotal, productLinkingLabel, selectedSumUpTotal])

  useEffect(() => {
    if (paymentChannel !== 'sumup' || !sumUpConnected || selectedSumUpTotal <= 0) return
    setMontant(selectedSumUpTotal.toFixed(2))
    // The setters come from a custom hook and are intentionally omitted to prevent rerun loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentChannel, sumUpConnected, selectedSumUpTotal])

  useEffect(() => {
    if (paymentChannel !== 'manual' || validationMode !== 'service') return
    if (selectedManualServicesTotal <= 0) {
      setMontant('')
      return
    }

    setMontant(selectedManualServicesTotal.toFixed(2))
    // The setter comes from a custom hook and is intentionally omitted to prevent rerun loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentChannel, validationMode, selectedManualServicesTotal])

  // Auto-switch to SumUp channel when SumUp is detected as connected
  useEffect(() => {
    if (!isSumUpLoading && sumUpConnected) {
      setPaymentChannel('sumup')
    }
  }, [isSumUpLoading, sumUpConnected])

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
    if (paymentChannel === 'manual' && validationMode === 'service' && selectedManualServiceIds.length > 0) {
      const names = services
        .filter((service) => selectedManualServiceIds.includes(service.id))
        .map((service) => service.nom)

      if (names.length > 0) {
        return names.join(', ')
      }
    }

    if (validationMode === 'amount') {
      const trimmed = customServiceName.trim()
      return trimmed || 'Achat libre'
    }

    if (selectedService) {
      return selectedService.nom
    }

    return 'Personnalisé'
  }, [paymentChannel, selectedManualServiceIds, services, selectedService, validationMode, customServiceName])

  const handleModeChange = (mode: ValidationMode) => {
    setValidationMode(mode)

    if (mode === 'amount') {
      clearSelectedService()
      setSelectedManualServiceIds([])
      return
    }

    if (mode === 'redemption') {
      clearSelectedService()
      setSelectedManualServiceIds([])
      return
    }

    clearSelectedService()
  }

  const handleValidate = async () => {
    try {
      const freeLabel = validationMode === 'amount' ? customServiceName.trim() || undefined : undefined
      const isSumUpChannel = paymentChannel === 'sumup'
      const isManualServiceSelection = paymentChannel === 'manual' && validationMode === 'service'
      const selectedItems = isSumUpChannel ? sumUpRecentTransactions.filter((item, index) => (
        selectedSumUpTransactionKeys.includes(transactionSelectionKey(item, index))
      )) : []
      const sumupTransactionIds = selectedItems
        .map((item) => item.id)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      const sumupTransactionCodes = selectedItems
        .map((item) => item.transaction_code)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

      const response = await validate(pendingTransaction.id, {
        freeAmountLabel: freeLabel,
        sumupTransactionIds,
        sumupTransactionCodes,
        service_ids: isSumUpChannel && selectedProductServiceIds.length > 0
          ? selectedProductServiceIds
          : isManualServiceSelection && selectedManualServiceIds.length > 0
            ? selectedManualServiceIds
            : undefined,
        product_label: isSumUpChannel ? productLinkingLabel.trim() || undefined : undefined,
      })
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
    <section className="relative flex max-h-[calc(100dvh-0.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-100 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-4 md:p-5">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2">
      <div className={`gap-3 sm:gap-4 ${validationMode === 'redemption' ? 'flex flex-col' : 'grid xl:grid-cols-2'}`}>
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
              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:space-y-4 sm:rounded-2xl sm:p-4">
                {/* Channel toggle: SumUp vs Manual */}
                {(isSumUpLoading || sumUpConnected) ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                    {isSumUpLoading ? (
                      <span className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                        Détection SumUp...
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setPaymentChannel('sumup') }}
                          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                            paymentChannel === 'sumup'
                              ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200'
                              : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                          }`}
                        >
                          💳 Avec SumUp
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPaymentChannel('manual') }}
                          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                            paymentChannel === 'manual'
                              ? 'border-zinc-500 bg-zinc-700/40 text-zinc-200'
                              : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                          }`}
                        >
                          🔧 Manuel
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* SumUp transaction list — only in SumUp channel */}
                {paymentChannel === 'sumup' && sumUpConnected ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-zinc-400">
                        Transactions SumUp récentes ({sumUpLookbackMinutes} min)
                      </p>
                      <label className="flex items-center gap-2 text-xs text-zinc-400">
                        Afficher
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={sumUpFetchLimit}
                          onChange={(event) => {
                            setSumUpFetchLimit(clampLimit(Number(event.target.value)))
                          }}
                          className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100 outline-none focus:border-indigo-400"
                        />
                        transactions
                      </label>
                    </div>
                    {sumUpRecentTransactions.length > 0 ? (
                      <div className="space-y-2">
                        {selectedSumUpTransactionKeys.length > 0 ? (
                          <p className="text-xs text-indigo-300">
                            {selectedSumUpTransactionKeys.length} transaction(s) sélectionnée(s) · Montant cumulé {selectedSumUpTotal.toFixed(2)} EUR
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-500">Sélectionnez les transactions à considérer pour le calcul des points.</p>
                        )}
                        {visibleSumUpTransactions.map(({ item, absoluteIndex }) => (
                          <label
                            key={item.id ?? item.transaction_code ?? `sumup-${absoluteIndex}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-indigo-600/30 bg-indigo-500/10 px-2.5 py-2 text-left text-xs text-indigo-200"
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedSumUpTransactionKeys.includes(transactionSelectionKey(item, absoluteIndex))}
                                onChange={(event) => {
                                  const key = transactionSelectionKey(item, absoluteIndex)
                                  setSelectedSumUpTransactionKeys((previous) => {
                                    if (event.target.checked) {
                                      if (previous.includes(key)) return previous
                                      return [...previous, key]
                                    }

                                    return previous.filter((entry) => entry !== key)
                                  })
                                }}
                                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                              />
                              <span className="block">
                                <span className="block font-semibold">
                                  {typeof item.amount === 'number' ? item.amount.toFixed(2) : '0.00'} {item.currency ?? 'EUR'}
                                </span>
                                <span className="block text-[11px] text-indigo-300/80">
                                  {item.transaction_code ?? 'Sans code'}
                                </span>
                              </span>
                            </span>
                            <span className="text-[11px] text-indigo-300/80">{formatRecentTimestamp(item.timestamp)}</span>
                          </label>
                        ))}
                        {sumUpTotalPages > 1 ? (
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setSumUpTransactionsPage((previous) => Math.max(1, previous - 1))}
                              disabled={sumUpTransactionsPage === 1}
                              className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              ← Precedent
                            </button>
                            <span className="text-[11px] text-zinc-500">Page {sumUpTransactionsPage}/{sumUpTotalPages}</span>
                            <button
                              type="button"
                              onClick={() => setSumUpTransactionsPage((previous) => Math.min(sumUpTotalPages, previous + 1))}
                              disabled={sumUpTransactionsPage === sumUpTotalPages}
                              className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Suivant →
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">Aucune transaction réussie récente.</p>
                    )}
                  </div>
                ) : null}

                {/* Product linking — only in SumUp channel */}
                {paymentChannel === 'sumup' && selectedSumUpTotal > 0 ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Liaison produits</p>
                      <span className="rounded-full border border-amber-600/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                        {selectedSumUpTotal.toFixed(2)} EUR à justifier
                      </span>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setProductLinkingMode('catalog')
                          setSelectedProductServiceIds([])
                          setProductServiceSearch('')
                          setProductCatalogPage(1)
                        }}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                          productLinkingMode === 'catalog'
                            ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                        }`}
                      >
                        📦 Catalogue
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProductLinkingMode('free-text')
                          setProductLinkingLabel('')
                        }}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                          productLinkingMode === 'free-text'
                            ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                        }`}
                      >
                        📝 Texte libre
                      </button>
                    </div>

                    {/* Catalog Mode */}
                    {productLinkingMode === 'catalog' ? (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-400">Sélectionnez des services pour atteindre exactement {selectedSumUpTotal.toFixed(2)} EUR</p>
                        {linkableServices.length === 0 ? (
                          <p className="text-xs text-zinc-500">Aucun service avec prix disponible. Utilisez le texte libre.</p>
                        ) : (
                          <>
                            {linkableServices.length > 8 ? (
                              <div>
                                <label htmlFor="product-service-search" className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-zinc-500">
                                  Rechercher un service
                                </label>
                                <input
                                  id="product-service-search"
                                  type="text"
                                  value={productServiceSearch}
                                  onChange={(event) => {
                                    setProductServiceSearch(event.target.value)
                                  }}
                                  placeholder="Nom du service"
                                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 outline-none transition focus:border-amber-400"
                                />
                              </div>
                            ) : null}
                            {filteredLinkableServices.length === 0 ? (
                              <p className="text-xs text-zinc-500">Aucun service ne correspond à la recherche.</p>
                            ) : (
                              <>
                                <div className="space-y-1.5 pr-1">
                                  {visibleProductServices.map((service) => (
                                  <label
                                    key={service.id}
                                    className="flex items-center gap-2 rounded-lg border border-amber-600/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200 cursor-pointer hover:bg-amber-500/15 transition"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedProductServiceIds.includes(service.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedProductServiceIds((prev) => [...prev, service.id])
                                        } else {
                                          setSelectedProductServiceIds((prev) => prev.filter((id) => id !== service.id))
                                        }
                                      }}
                                      className="h-4 w-4 rounded border-amber-600 bg-zinc-900"
                                    />
                                    <span>{service.emoji ?? '•'} {service.nom}</span>
                                    <span className="ml-auto font-semibold">{(service.prix_defaut ?? 0).toFixed(2)} EUR</span>
                                  </label>
                                  ))}
                                </div>
                                {productCatalogTotalPages > 1 ? (
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setProductCatalogPage((previous) => Math.max(1, previous - 1))}
                                      disabled={productCatalogPage === 1}
                                      className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      ← Precedent
                                    </button>
                                    <span className="text-[11px] text-zinc-500">Page {productCatalogPage}/{productCatalogTotalPages}</span>
                                    <button
                                      type="button"
                                      onClick={() => setProductCatalogPage((previous) => Math.min(productCatalogTotalPages, previous + 1))}
                                      disabled={productCatalogPage === productCatalogTotalPages}
                                      className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Suivant →
                                    </button>
                                  </div>
                                ) : null}
                              </>
                            )}
                            <div className="mt-2 rounded-lg bg-zinc-900 p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-zinc-500">Total:</span>
                                <span className={`text-sm font-semibold ${productLinkingValidation?.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {selectedProductServicesTotal.toFixed(2)} / {selectedSumUpTotal.toFixed(2)} EUR
                                </span>
                              </div>
                              <div className="w-full bg-zinc-800 rounded-full h-2">
                                <div
                                  className={`h-full rounded-full transition-all ${productLinkingValidation?.isValid ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                  style={{
                                    width: `${Math.min(100, (selectedProductServicesTotal / selectedSumUpTotal) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label htmlFor="product-label" className="block text-xs text-zinc-400">
                          Libellé du service/produit
                        </label>
                        <input
                          id="product-label"
                          type="text"
                          value={productLinkingLabel}
                          onChange={(e) => setProductLinkingLabel(e.target.value)}
                          placeholder="Ex: Achat en boutique, Service réparation..."
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
                        />
                        <div className="rounded-lg bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                          Montant: <span className="font-semibold text-zinc-100">{selectedSumUpTotal.toFixed(2)} EUR</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Service selector and mode buttons — only in Manual channel */}
                {paymentChannel === 'manual' ? (
                  <>
                    {validationMode === 'service' ? (
                      servicesLoading ? (
                        <div className="flex min-h-32 items-center justify-center">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
                        </div>
                      ) : filteredManualServices.length > 0 ? (
                        <>
                          {services.length > 8 ? (
                            <div>
                              <label htmlFor="manual-service-search" className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-zinc-500">
                                Rechercher un service
                              </label>
                              <input
                                id="manual-service-search"
                                type="text"
                                value={manualServiceSearch}
                                onChange={(event) => {
                                  setManualServiceSearch(event.target.value)
                                }}
                                placeholder="Nom du service"
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 outline-none transition focus:border-teal-400"
                              />
                            </div>
                          ) : null}
                          <div className="space-y-1.5 pr-1">
                            {visibleServices.map((service) => (
                              <label
                                key={service.id}
                                className="flex items-center gap-2 rounded-lg border border-teal-600/30 bg-teal-500/10 px-2.5 py-2 text-xs text-teal-200 cursor-pointer hover:bg-teal-500/15 transition"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedManualServiceIds.includes(service.id)}
                                  onChange={(event) => {
                                    if (event.target.checked) {
                                      setSelectedManualServiceIds((previous) => [...previous, service.id])
                                    } else {
                                      setSelectedManualServiceIds((previous) => previous.filter((id) => id !== service.id))
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-teal-600 bg-zinc-900"
                                />
                                <span>{service.emoji ?? '•'} {service.nom}</span>
                                <span className="ml-auto font-semibold">{(service.prix_defaut ?? 0).toFixed(2)} EUR</span>
                              </label>
                            ))}
                          </div>
                          {manualTotalPages > 1 ? (
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setManualPage((previous) => Math.max(1, previous - 1))}
                                disabled={manualPage === 1}
                                className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                ← Precedent
                              </button>
                              <span className="text-[11px] text-zinc-500">Page {manualPage}/{manualTotalPages}</span>
                              <button
                                type="button"
                                onClick={() => setManualPage((previous) => Math.min(manualTotalPages, previous + 1))}
                                disabled={manualPage === manualTotalPages}
                                className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Suivant →
                              </button>
                            </div>
                          ) : null}
                          {selectedManualServiceIds.length > 0 ? (
                            <div className="mt-2 rounded-lg bg-zinc-900 p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-zinc-500">Total sélection:</span>
                                <span className="text-sm font-semibold text-teal-300">{selectedManualServicesTotal.toFixed(2)} EUR</span>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="py-4 text-center text-sm text-zinc-400">
                          {services.length > 0 ? 'Aucun service ne correspond à la recherche.' : 'Aucun service configuré. Utilisez le montant libre.'}
                        </p>
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
                  </>
                ) : null}
              </div>
            </div>

            {paymentChannel === 'manual' ? (
              <div className="order-3 min-w-0 xl:order-2">
                <PriceInput
                  montant={montant}
                  onMontantChange={setMontant}
                  pointsPreview={pointsPreview}
                  selectedService={selectedService}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
      </div>

      {validationMode !== 'redemption' ? (
        <div className="mt-3 shrink-0 border-t border-zinc-800 pt-3 sm:mt-5 sm:pt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-4 sm:py-3 sm:text-sm"
        >
          ✗ Annuler
        </button>
        <button
          type="button"
          onClick={handleValidate}
          disabled={
            isSubmitting ||
            (paymentChannel === 'sumup'
              ? selectedSumUpTotal <= 0 || !productLinkingValidation?.isValid
              : !canValidate || (validationMode === 'service' && servicesLoading))
          }
          title={paymentChannel === 'sumup' && !productLinkingValidation?.isValid ? 'Complétez la liaison produits' : undefined}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-3 sm:text-sm"
        >
          ✓ Valider
        </button>
        </div>
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
