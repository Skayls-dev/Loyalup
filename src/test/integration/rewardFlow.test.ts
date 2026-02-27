import { describe, expect, it, vi } from 'vitest'
import { creditPoints } from '../../modules/transactions/services/transactionService'
import { getAvailableRewards, subscribeToRewards, useReward } from '../../modules/loyalty/services/loyaltyService'
import {
  emitRealtimeByPrefix,
  setFunctionError,
  setFunctionResult,
  setTableData,
} from '../mocks/supabase'
import { createMockRewardRule } from '../factories'

describe('integration: reward flow', () => {
  it('success path: points → unlock notification → use reward', async () => {
    const rewardNotification = vi.fn()
    subscribeToRewards('client-1', rewardNotification)

    const credit = await creditPoints({ pending_transaction_id: 'pending-1', montant: 30 })
    expect(credit.points_credited).toBeGreaterThan(0)

    setTableData('reward_rules', [createMockRewardRule({ id: 'rule-1', points_required: 300 })])

    emitRealtimeByPrefix('loyalty-rewards-client-1-', {
      new: {
        id: 'reward-1',
        client_id: 'client-1',
        fournisseur_id: 'fournisseur-1',
        reward_rule_id: 'rule-1',
        status: 'available',
        unlocked_at: new Date().toISOString(),
        used_at: null,
        created_at: new Date().toISOString(),
      },
    })

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

    const available = await getAvailableRewards('client-1')
    expect(available.length).toBe(1)

    setFunctionResult('unlock-reward', {
      success: true,
      points_deducted: 300,
      new_balance: 0,
    })

    const used = await useReward('reward-1')
    expect(used.success).toBe(true)
    expect(used.points_deducted).toBe(300)
    expect(rewardNotification).toHaveBeenCalled()
  })

  it('edge case: insufficient points', async () => {
    setFunctionError('unlock-reward', 'INSUFFICIENT_POINTS')
    await expect(useReward('insufficient')).rejects.toThrow('INSUFFICIENT_POINTS')
  })
})
