import { useMemo, useState } from 'react'
import {
  redeemPoints,
  type RedeemPointsResponse,
  type RedemptionRule,
} from '../services/redemptionService'

type UseRedemptionParams = {
  clientSolde: number
  pointsConversionRate?: number
}

type UseRedemptionResult = {
  selectedRule: RedemptionRule | null
  customPoints: string
  pointsToRedeem: number
  discountPreview: number
  isSubmitting: boolean
  isSuccess: boolean
  error: string | null
  canRedeem: boolean
  selectRule: (rule: RedemptionRule) => void
  clearRule: () => void
  setCustomPoints: (value: string) => void
  redeem: (pending_transaction_id: string) => Promise<RedeemPointsResponse>
  reset: () => void
}

function sanitizeCustomPoints(value: string): string {
  return value.replace(',', '.').replace(/[^0-9.]/g, '')
}

function computePointsToRedeem(selectedRule: RedemptionRule | null, customPoints: string): number {
  if (selectedRule?.points_cost != null) {
    return selectedRule.points_cost
  }

  const parsed = Number.parseFloat(customPoints)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0
  }

  return Math.floor(parsed)
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

function computeDiscountPreview(
  selectedRule: RedemptionRule | null,
  pointsToRedeem: number,
  pointsConversionRate?: number,
): number {
  if (pointsToRedeem <= 0) {
    return 0
  }

  const rate = Number(pointsConversionRate)
  const hasValidRate = Number.isFinite(rate) && rate > 0

  if (!selectedRule) {
    if (!hasValidRate) {
      return 0
    }

    return roundToCents(pointsToRedeem / rate)
  }

  if (selectedRule.discount_type === 'fixed') {
    return roundToCents(Math.max(0, selectedRule.discount_value))
  }

  if (!hasValidRate) {
    return 0
  }

  const eurValue = pointsToRedeem / rate
  const percentDiscount = eurValue * (selectedRule.discount_value / 100)

  if (selectedRule.max_discount_eur != null) {
    return roundToCents(Math.min(percentDiscount, selectedRule.max_discount_eur))
  }

  return roundToCents(percentDiscount)
}

export function useRedemption({
  clientSolde,
  pointsConversionRate,
}: UseRedemptionParams): UseRedemptionResult {
  const [selectedRule, setSelectedRule] = useState<RedemptionRule | null>(null)
  const [customPoints, setCustomPointsState] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pointsToRedeem = useMemo(
    () => computePointsToRedeem(selectedRule, customPoints),
    [selectedRule, customPoints],
  )

  const discountPreview = useMemo(
    () => computeDiscountPreview(selectedRule, pointsToRedeem, pointsConversionRate),
    [selectedRule, pointsToRedeem, pointsConversionRate],
  )

  const canRedeem = useMemo(
    () => clientSolde >= pointsToRedeem && pointsToRedeem > 0,
    [clientSolde, pointsToRedeem],
  )

  const selectRule = (rule: RedemptionRule) => {
    setSelectedRule(rule)
    setError(null)
  }

  const clearRule = () => {
    setSelectedRule(null)
    setError(null)
  }

  const setCustomPoints = (value: string) => {
    setError(null)
    setIsSuccess(false)
    setSelectedRule(null)
    setCustomPointsState(sanitizeCustomPoints(value))
  }

  const redeem = async (pending_transaction_id: string): Promise<RedeemPointsResponse> => {
    if (!canRedeem) {
      throw new Error('Points insuffisants ou montant invalide')
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await redeemPoints({
        pending_transaction_id,
        redemption_rule_id: selectedRule?.id,
        points_to_redeem: pointsToRedeem,
      })

      setIsSuccess(true)
      return result
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Redemption impossible'
      setError(message)
      throw new Error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const reset = () => {
    setSelectedRule(null)
    setCustomPointsState('')
    setIsSubmitting(false)
    setIsSuccess(false)
    setError(null)
  }

  return {
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
  }
}
