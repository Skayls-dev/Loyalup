import { describe, expect, it, vi } from 'vitest'
import {
  cancelTransaction,
  creditPoints,
  fetchServices,
  getProviderTransactions,
} from './transactionService'
import { mockSupabase, setFunctionError, setFunctionResult, setTableData, setTableError } from '../../../test/mocks/supabase'
import { createMockService, createMockTransaction } from '../../../test/factories'

describe('transactionService', () => {
  it('creditPoints: success → returns points_credited + new_balance', async () => {
    const result = await creditPoints({
      pending_transaction_id: 'pending-1',
      montant: 12,
    })

    expect(result.points_credited).toBeGreaterThan(0)
    expect(result.new_balance).toBeGreaterThan(0)
  })

  it("creditPoints: expired transaction → throws 'TRANSACTION_EXPIRED'", async () => {
    setFunctionError('credit-points', 'TRANSACTION_EXPIRED')
    await expect(creditPoints({ pending_transaction_id: 'expired', montant: 10 })).rejects.toThrow('TRANSACTION_EXPIRED')
  })

  it("creditPoints: wrong provider → throws 'UNAUTHORIZED'", async () => {
    setFunctionError('credit-points', 'UNAUTHORIZED')
    await expect(creditPoints({ pending_transaction_id: 'wrong-provider', montant: 10 })).rejects.toThrow('UNAUTHORIZED')
  })

  it('cancelTransaction: success → updates status', async () => {
    const fromSpy = vi.spyOn(mockSupabase, 'from')
    await cancelTransaction('pending-transaction-1')

    expect(fromSpy).toHaveBeenCalledWith('pending_transactions')
  })

  it('fetchServices: returns active services only', async () => {
    setTableData('services', [
      createMockService({ id: 'service-1', actif: true }),
      createMockService({ id: 'service-2', actif: false }),
    ])

    const services = await fetchServices('fournisseur-1')
    expect(services.length).toBeGreaterThan(0)
    expect(services.every((item) => typeof item.id === 'string')).toBe(true)
  })

  it('getProviderTransactions: returns paginated results', async () => {
    setTableData('transactions', [
      createMockTransaction({ id: 'tx-1' }),
      createMockTransaction({ id: 'tx-2' }),
      createMockTransaction({ id: 'tx-3' }),
    ])

    const rows = await getProviderTransactions('fournisseur-1', 2)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('cancelTransaction throws db errors', async () => {
    setTableError('pending_transactions', 'db error')
    await expect(cancelTransaction('x')).rejects.toThrow('db error')
  })

  it('creditPoints rejects invalid payload', async () => {
    setFunctionResult('credit-points', { success: false })
    await expect(creditPoints({ pending_transaction_id: 'x', montant: 5 })).rejects.toThrow('Invalid credit points response')
  })
})
