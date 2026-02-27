import { describe, expect, it } from 'vitest'
import { generateToken, subscribeToPendingTransactions, unsubscribe, validateToken } from './qrService'
import { mockSupabase, setFunctionError, setFunctionResult } from '../../../test/mocks/supabase'

describe('qrService', () => {
  it('generateToken: success → returns token + expires_at', async () => {
    const result = await generateToken()
    expect(result.token).toBeTruthy()
    expect(result.expires_at).toBeTruthy()
  })

  it('generateToken: network error → throws with message', async () => {
    setFunctionError('generate-qr', 'Network error')
    await expect(generateToken()).rejects.toThrow('Network error')
  })

  it('validateToken: valid token → returns fournisseur_id + transaction_id', async () => {
    const result = await validateToken('VALID')
    expect(result.fournisseur_id).toBe('fournisseur-1')
    expect(result.transaction_id).toBe('pending-transaction-1')
  })

  it("validateToken: expired token → throws 'TOKEN_EXPIRED'", async () => {
    setFunctionError('validate-qr', 'TOKEN_EXPIRED')
    await expect(validateToken('EXPIRED')).rejects.toThrow('TOKEN_EXPIRED')
  })

  it("validateToken: already used → throws 'TOKEN_USED'", async () => {
    setFunctionError('validate-qr', 'TOKEN_USED')
    await expect(validateToken('USED')).rejects.toThrow('TOKEN_USED')
  })

  it("validateToken: already scanned today → throws 'ALREADY_SCANNED'", async () => {
    setFunctionError('validate-qr', 'ALREADY_SCANNED')
    await expect(validateToken('ALREADY_SCANNED')).rejects.toThrow('ALREADY_SCANNED')
  })

  it('subscribeToTransactions: sets up Realtime correctly', () => {
    const callback = vi.fn()
    subscribeToPendingTransactions('fournisseur-1', callback)

    expect(mockSupabase.channel).toHaveBeenCalled()
    expect(callback).not.toHaveBeenCalled()
  })

  it('unsubscribe: cleans up channel', () => {
    subscribeToPendingTransactions('fournisseur-1', vi.fn())
    unsubscribe()

    expect(mockSupabase.removeChannel).toHaveBeenCalled()
  })

  it('validateToken invalid payload throws', async () => {
    setFunctionResult('validate-qr', { success: false })
    await expect(validateToken('BAD')).rejects.toThrow('Invalid validate token response')
  })
})
