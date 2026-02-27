import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQRScan } from './useQRScan'

const validateTokenMock = vi.fn()

vi.mock('../services/qrService', () => ({
  validateToken: (...args: unknown[]) => validateTokenMock(...args),
}))

describe('useQRScan', () => {
  beforeEach(() => {
    validateTokenMock.mockResolvedValue({
      success: true,
      fournisseur_id: 'fournisseur-1',
      transaction_id: 'transaction-1',
    })
  })

  it('startScan: initializes html5-qrcode correctly', async () => {
    const { result } = renderHook(() => useQRScan())

    await act(async () => {
      await result.current.startScan()
    })

    expect(result.current.error).toBeNull()
  })

  it('successful scan: calls validateToken with scanned value', async () => {
    const { Html5Qrcode } = await import('html5-qrcode')
    const startImpl = vi.fn(async (_cam, _cfg, onSuccess: (text: string) => void) => {
      await onSuccess('QR-VALID')
    })
    vi.mocked(Html5Qrcode).mockImplementation(
      function Html5QrcodeMock() {
        return {
          start: startImpl,
          stop: vi.fn(async () => undefined),
          clear: vi.fn(() => undefined),
          isScanning: false,
        } as never
      },
    )

    const { result } = renderHook(() => useQRScan())
    await act(async () => {
      await result.current.startScan()
    })

    expect(validateTokenMock).toHaveBeenCalledWith('QR-VALID')
  })

  it('failed validation: sets error state', async () => {
    validateTokenMock.mockRejectedValueOnce(new Error('TOKEN_EXPIRED'))

    const { Html5Qrcode } = await import('html5-qrcode')
    vi.mocked(Html5Qrcode).mockImplementation(
      function Html5QrcodeMock() {
        return {
          start: vi.fn(async (_cam, _cfg, onSuccess: (text: string) => void) => {
            await onSuccess('EXPIRED')
          }),
          stop: vi.fn(async () => undefined),
          clear: vi.fn(() => undefined),
          isScanning: false,
        } as never
      },
    )

    const { result } = renderHook(() => useQRScan())
    await act(async () => {
      await result.current.startScan()
      await Promise.resolve()
    })

    expect(result.current.error).toBe('TOKEN_EXPIRED')
  })

  it('stopScan: stops camera correctly', async () => {
    const stopMock = vi.fn(async () => undefined)
    const { Html5Qrcode } = await import('html5-qrcode')
    vi.mocked(Html5Qrcode).mockImplementation(
      function Html5QrcodeMock() {
        return {
          start: vi.fn(async () => undefined),
          stop: stopMock,
          clear: vi.fn(() => undefined),
          isScanning: true,
        } as never
      },
    )

    const { result } = renderHook(() => useQRScan())
    await act(async () => {
      await result.current.startScan()
      await result.current.stopScan()
    })

    expect(stopMock).toHaveBeenCalled()
  })

  it('success state resets after navigation (new scan start)', async () => {
    const { Html5Qrcode } = await import('html5-qrcode')
    vi.mocked(Html5Qrcode).mockImplementation(
      function Html5QrcodeMock() {
        return {
          start: vi.fn(async (_cam, _cfg, onSuccess: (text: string) => void) => {
            await onSuccess('QR-1')
          }),
          stop: vi.fn(async () => undefined),
          clear: vi.fn(() => undefined),
          isScanning: false,
        } as never
      },
    )

    const { result } = renderHook(() => useQRScan())

    await act(async () => {
      await result.current.startScan()
    })

    expect(result.current.success).toBe(true)

    vi.mocked(Html5Qrcode).mockImplementation(
      function Html5QrcodeMock() {
        return {
          start: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined),
          clear: vi.fn(() => undefined),
          isScanning: false,
        } as never
      },
    )

    await act(async () => {
      await result.current.stopScan()
      await result.current.startScan()
    })

    expect(result.current.success).toBe(false)
  })
})
