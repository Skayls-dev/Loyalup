import { useMemo, useState } from 'react'
import {
  cancelTransaction,
  creditPoints,
  type CreditPointsResponse,
  type Service,
} from '../services/transactionService'

type UseValidationResult = {
  selectedService: Service | null
  montant: string
  pointsPreview: number
  isSubmitting: boolean
  isSuccess: boolean
  error: string | null
  canValidate: boolean
  selectService: (service: Service) => void
  clearSelectedService: () => void
  setMontant: (value: string) => void
  validate: (
    pending_transaction_id: string,
    options?: {
      freeAmountLabel?: string
      sumupTransactionIds?: string[]
      sumupTransactionCodes?: string[]
      service_ids?: string[]
      product_label?: string
    },
  ) => Promise<CreditPointsResponse>
  cancel: (pending_transaction_id: string) => Promise<void>
  reset: () => void
}

function sanitizeMontant(value: string): string {
  return value.replace(',', '.').replace(/[^0-9.]/g, '')
}

function computePointsPreview(service: Service | null, montant: string): number {
  if (service?.points_defaut != null) {
    return service.points_defaut
  }

  const parsed = Number.parseFloat(montant)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0
  }

  const rate = service?.points_per_euro ?? 10
  return Math.floor(parsed * rate)
}

export function useValidation(): UseValidationResult {
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [montant, setMontantState] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pointsPreview = useMemo(
    () => computePointsPreview(selectedService, montant),
    [selectedService, montant],
  )

  const canValidate = useMemo(() => {
    const value = Number.parseFloat(montant)
    return Number.isFinite(value) && value > 0
  }, [montant])

  const selectService = (service: Service) => {
    setSelectedService(service)
    setError(null)

    if (service.prix_defaut != null) {
      setMontantState(service.prix_defaut.toFixed(2))
    }
  }

  const clearSelectedService = () => {
    setSelectedService(null)
    setError(null)
  }

  const setMontant = (value: string) => {
    setError(null)
    setMontantState(sanitizeMontant(value))
  }

  const validate = async (
    pending_transaction_id: string,
    options?: {
      freeAmountLabel?: string
      sumupTransactionIds?: string[]
      sumupTransactionCodes?: string[]
      service_ids?: string[]
      product_label?: string
    },
  ): Promise<CreditPointsResponse> => {
    const value = Number.parseFloat(montant)

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Montant invalide')
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await creditPoints({
        pending_transaction_id,
        service_id: selectedService?.id,
        service_nom_libre: options?.freeAmountLabel?.trim() || undefined,
        montant: value,
        sumup_transaction_ids: options?.sumupTransactionIds,
        sumup_transaction_codes: options?.sumupTransactionCodes,
        service_ids: options?.service_ids,
        product_label: options?.product_label,
      })

      setIsSuccess(true)
      return result
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Validation impossible'
      setError(message)
      throw new Error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const cancel = async (pending_transaction_id: string): Promise<void> => {
    setIsSubmitting(true)
    setError(null)

    try {
      await cancelTransaction(pending_transaction_id)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Annulation impossible'
      setError(message)
      throw new Error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const reset = () => {
    setSelectedService(null)
    setMontantState('')
    setIsSubmitting(false)
    setIsSuccess(false)
    setError(null)
  }

  return {
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
  }
}
