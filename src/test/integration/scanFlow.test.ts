import { describe, expect, it, vi } from 'vitest'
import { generateToken, subscribeToPendingTransactions, validateToken } from '../../modules/qr/services/qrService'
import { creditPoints, subscribeToClientPoints } from '../../modules/transactions/services/transactionService'
import { emitRealtimeByPrefix, setFunctionError, setFunctionResult } from '../mocks/supabase'

describe('integration: scan flow', () => {
  it('success path: full scan → validate → credit → realtime updates', async () => {
    const providerRealtime = vi.fn()
    const clientRealtime = vi.fn()

    subscribeToPendingTransactions('fournisseur-1', providerRealtime)
    subscribeToClientPoints('client-1', 'fournisseur-1', clientRealtime)

    const generated = await generateToken()
    expect(generated.token).toBeTruthy()

    const validated = await validateToken(generated.token)
    expect(validated.success).toBe(true)

    emitRealtimeByPrefix('pending-transactions-fournisseur-1', {
      new: {
        id: validated.transaction_id,
        qr_token_id: 'qr-1',
        client_id: 'client-1',
        fournisseur_id: 'fournisseur-1',
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 120_000).toISOString(),
      },
    })

    const credited = await creditPoints({
      pending_transaction_id: validated.transaction_id,
      service_id: 'service-1',
      montant: 12,
    })
    expect(credited.success).toBe(true)

    emitRealtimeByPrefix('client-points-client-1-fournisseur-1', {
      new: {
        id: 'cp-1',
        client_id: 'client-1',
        fournisseur_id: 'fournisseur-1',
        solde: credited.new_balance,
        total_visites: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })

    expect(providerRealtime).toHaveBeenCalled()
    expect(clientRealtime).toHaveBeenCalled()
  })

  it('failure path: token validation fails', async () => {
    setFunctionError('validate-qr', 'TOKEN_EXPIRED')

    await expect(validateToken('EXPIRED')).rejects.toThrow('TOKEN_EXPIRED')
  })

  it('failure path: credit points rejects unauthorized', async () => {
    setFunctionResult('validate-qr', {
      success: true,
      fournisseur_id: 'fournisseur-1',
      transaction_id: 'pending-1',
    })
    setFunctionError('credit-points', 'UNAUTHORIZED')

    await expect(
      creditPoints({ pending_transaction_id: 'pending-1', montant: 10 }),
    ).rejects.toThrow('UNAUTHORIZED')
  })
})
