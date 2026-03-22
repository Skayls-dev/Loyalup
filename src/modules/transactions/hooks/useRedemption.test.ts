import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RedemptionRule } from '../services/redemptionService'
import { useRedemption } from './useRedemption'

const redeemPointsMock = vi.fn()

vi.mock('../services/redemptionService', () => ({
  redeemPoints: (...args: unknown[]) => redeemPointsMock(...args),
}))

function makeRule(overrides: Partial<RedemptionRule> = {}): RedemptionRule {
  return {
    id: 'rule-1',
    fournisseur_id: 'fournisseur-1',
    label: 'Regle test',
    points_cost: 200,
    discount_value: 2,
    discount_type: 'fixed',
    max_discount_eur: null,
    actif: true,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('useRedemption', () => {
  beforeEach(() => {
    redeemPointsMock.mockReset()
    redeemPointsMock.mockResolvedValue({
      success: true,
      points_deducted: 200,
      discount_applied: 2.0,
      new_balance: 300,
    })
  })

  it('canRedeem est false si clientSolde < pointsToRedeem', () => {
    const { result } = renderHook(() => useRedemption({ clientSolde: 100 }))

    act(() => {
      result.current.setCustomPoints('200')
    })

    expect(result.current.pointsToRedeem).toBe(200)
    expect(result.current.canRedeem).toBe(false)
  })

  it('canRedeem est true si clientSolde >= pointsToRedeem', () => {
    const { result } = renderHook(() => useRedemption({ clientSolde: 250 }))

    act(() => {
      result.current.setCustomPoints('200')
    })

    expect(result.current.pointsToRedeem).toBe(200)
    expect(result.current.canRedeem).toBe(true)
  })

  it('selectRule met a jour pointsToRedeem avec rule.points_cost', () => {
    const { result } = renderHook(() => useRedemption({ clientSolde: 1000 }))
    const rule = makeRule({ points_cost: 450 })

    act(() => {
      result.current.selectRule(rule)
    })

    expect(result.current.pointsToRedeem).toBe(450)
  })

  it('redeem() appelle redeemPoints avec le bon pending_transaction_id', async () => {
    const { result } = renderHook(() => useRedemption({ clientSolde: 500 }))

    act(() => {
      result.current.setCustomPoints('200')
    })

    await act(async () => {
      await result.current.redeem('pending-123')
    })

    expect(redeemPointsMock).toHaveBeenCalledWith({
      pending_transaction_id: 'pending-123',
      redemption_rule_id: undefined,
      points_to_redeem: 200,
    })
  })

  it('isSuccess passe a true apres un redeem reussi', async () => {
    const { result } = renderHook(() => useRedemption({ clientSolde: 500 }))

    act(() => {
      result.current.setCustomPoints('200')
    })

    await act(async () => {
      await result.current.redeem('pending-123')
    })

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('error est set si redeemPoints throw', async () => {
    redeemPointsMock.mockRejectedValueOnce(new Error('INSUFFICIENT_POINTS'))
    const { result } = renderHook(() => useRedemption({ clientSolde: 500 }))

    act(() => {
      result.current.setCustomPoints('200')
    })

    await act(async () => {
      await expect(result.current.redeem('pending-123')).rejects.toThrow('INSUFFICIENT_POINTS')
    })

    expect(result.current.error).toBe('INSUFFICIENT_POINTS')
    expect(result.current.isSuccess).toBe(false)
  })

  it('reset() remet le state a l etat initial', async () => {
    const { result } = renderHook(() => useRedemption({ clientSolde: 500, pointsConversionRate: 100 }))
    const rule = makeRule({ points_cost: 200, discount_value: 2, discount_type: 'fixed' })

    act(() => {
      result.current.selectRule(rule)
    })

    await act(async () => {
      await result.current.redeem('pending-123')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.selectedRule).toBeNull()
    expect(result.current.customPoints).toBe('')
    expect(result.current.pointsToRedeem).toBe(0)
    expect(result.current.discountPreview).toBe(0)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.canRedeem).toBe(false)
  })

  it('discountPreview calcule correctement pour discount_type fixed', () => {
    const { result } = renderHook(() => useRedemption({ clientSolde: 1000, pointsConversionRate: 100 }))
    const rule = makeRule({
      points_cost: 300,
      discount_type: 'fixed',
      discount_value: 2.5,
    })

    act(() => {
      result.current.selectRule(rule)
    })

    expect(result.current.pointsToRedeem).toBe(300)
    expect(result.current.discountPreview).toBe(2.5)
  })

  it('discountPreview calcule correctement pour discount_type percent avec plafond max_discount_eur', () => {
    const { result } = renderHook(() => useRedemption({ clientSolde: 2000, pointsConversionRate: 100 }))
    const rule = makeRule({
      points_cost: 1000,
      discount_type: 'percent',
      discount_value: 50,
      max_discount_eur: 3,
    })

    act(() => {
      result.current.selectRule(rule)
    })

    expect(result.current.pointsToRedeem).toBe(1000)
    expect(result.current.discountPreview).toBe(3)
  })
})
