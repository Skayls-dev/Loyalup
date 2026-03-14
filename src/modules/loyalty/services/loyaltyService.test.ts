import { describe, expect, it, vi } from 'vitest'
import {
  getAvailableRewards,
  getClientCards,
  getClientPartnerBalance,
  getTransactionHistory,
  subscribeToPoints,
  useReward,
} from './loyaltyService'
import {
  emitRealtimeByPrefix,
  setFunctionError,
  setFunctionResult,
  setTableData,
} from '../../../test/mocks/supabase'
import {
  createMockClientPoints,
  createMockRewardRule,
  createMockTransaction,
} from '../../../test/factories'

describe('loyaltyService', () => {
  it('getClientCards: returns all enrolled providers with points', async () => {
    setTableData('client_points', [createMockClientPoints()])
    setTableData('fournisseurs', [{ id: 'fournisseur-1', nom_commerce: 'Coffee Loyal', adresse: 'Paris' }])

    const cards = await getClientCards('client-1')
    expect(cards.length).toBe(1)
    expect(cards[0].fournisseur.nom_commerce).toBe('Coffee Loyal')
  })

  it('getClientCards: empty → returns []', async () => {
    setTableData('client_points', [])
    const cards = await getClientCards('client-1')
    expect(cards).toEqual([])
  })

  it('getTransactionHistory: first page returns items', async () => {
    setTableData('transactions', Array.from({ length: 20 }, (_, index) => ({
      ...createMockTransaction({ id: `tx-${index}` }),
      services: { nom: 'Service', emoji: '✨' },
      fournisseurs: { nom_commerce: 'Commerce' },
    })))

    const rows = await getTransactionHistory('client-1', undefined, 0, 20)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('getTransactionHistory: loadMore appends next page', async () => {
    setTableData('transactions', Array.from({ length: 25 }, (_, index) => ({
      ...createMockTransaction({ id: `tx-${index}` }),
      services: { nom: 'Service', emoji: '✨' },
      fournisseurs: { nom_commerce: 'Commerce' },
    })))

    const page1 = await getTransactionHistory('client-1', undefined, 0, 20)
    const page2 = await getTransactionHistory('client-1', undefined, 1, 20)

    expect([...page1, ...page2].length).toBeGreaterThan(page1.length)
  })

  it("getAvailableRewards: returns only 'available' status", async () => {
    setTableData('client_rewards', [
      {
        id: 'reward-1',
        client_id: 'client-1',
        fournisseur_id: 'fournisseur-1',
        reward_rule_id: 'rule-1',
        status: 'available',
        unlocked_at: new Date().toISOString(),
        used_at: null,
        created_at: new Date().toISOString(),
        reward_rule: createMockRewardRule({ id: 'rule-1' }),
      },
    ])

    const rewards = await getAvailableRewards('client-1')
    expect(rewards.every((item) => item.status === 'available')).toBe(true)
  })

  it('useReward: success → deducts points + marks used', async () => {
    setFunctionResult('unlock-reward', { success: true, points_deducted: 50, new_balance: 150 })
    const result = await useReward('reward-1')

    expect(result.success).toBe(true)
    expect(result.points_deducted).toBe(50)
    expect(result.new_balance).toBe(150)
  })

  it('useReward: insufficient points → throws error', async () => {
    setFunctionError('unlock-reward', 'INSUFFICIENT_POINTS')
    await expect(useReward('insufficient')).rejects.toThrow('INSUFFICIENT_POINTS')
  })

  it('subscribeToPoints: callback fires on Realtime update', () => {
    const callback = vi.fn()
    const unsubscribe = subscribeToPoints('client-1', 'fournisseur-1', callback)

    emitRealtimeByPrefix('loyalty-points-client-1-fournisseur-1-', {
      new: { fournisseur_id: 'fournisseur-1', solde: 450 },
    })

    expect(callback).toHaveBeenCalledWith(450)
    expect(typeof unsubscribe).toBe('function')
  })

  it('getClientPartnerBalance: returns partner wallet for current client', async () => {
    setFunctionResult('get-client-partner-balance', {
      success: true,
      partner_balance: 275,
      updated_at: '2026-03-13T10:00:00.000Z',
    })

    const result = await getClientPartnerBalance('client-1')

    expect(result).toEqual({
      partner_balance: 275,
      updated_at: '2026-03-13T10:00:00.000Z',
    })
  })
})
