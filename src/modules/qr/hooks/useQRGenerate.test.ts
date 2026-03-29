import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQRGenerate } from './useQRGenerate'

const generateTokenMock = vi.fn()

vi.mock('../services/qrService', () => ({
  generateToken: (...args: unknown[]) => generateTokenMock(...args),
}))

describe('useQRGenerate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    generateTokenMock.mockResolvedValue({
      token: 'QR-1',
      expires_at: new Date(Date.now() + 180_000).toISOString(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('on mount: calls generateToken immediately', async () => {
    renderHook(() => useQRGenerate())

    await act(async () => {
      await Promise.resolve()
    })

    expect(generateTokenMock).toHaveBeenCalledTimes(1)
  })

  it('token refreshes automatically before expiry (fake timers)', async () => {
    renderHook(() => useQRGenerate())

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(170_000)
      await Promise.resolve()
    })

    expect(generateTokenMock).toHaveBeenCalledTimes(2)
  })

  it('secondsLeft counts down correctly', async () => {
    const { result } = renderHook(() => useQRGenerate())

    await act(async () => {
      await Promise.resolve()
    })

    const initial = result.current.secondsLeft

    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })

    expect(result.current.secondsLeft).toBeLessThan(initial)
  })

  it('on unmount: clears interval', async () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const { unmount } = renderHook(() => useQRGenerate())

    await act(async () => {
      await Promise.resolve()
    })

    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('retries quickly after transient failure', async () => {
    generateTokenMock
      .mockRejectedValueOnce(new Error('Session expirée, reconnectez-vous.'))
      .mockResolvedValueOnce({
        token: 'QR-RECOVERY',
        expires_at: new Date(Date.now() + 180_000).toISOString(),
      })

    const { result } = renderHook(() => useQRGenerate())

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(2_000)
      await Promise.resolve()
    })

    expect(generateTokenMock).toHaveBeenCalledTimes(2)
    expect(result.current.token).toBe('QR-RECOVERY')
    expect(result.current.warning).toBeNull()
  })

  it('clears stale token on online regeneration failure', async () => {
    generateTokenMock
      .mockResolvedValueOnce({
        token: 'QR-INITIAL',
        expires_at: new Date(Date.now() + 180_000).toISOString(),
      })
      .mockRejectedValueOnce(new Error('Backend unavailable'))

    const { result } = renderHook(() => useQRGenerate())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.token).toBe('QR-INITIAL')

    await act(async () => {
      vi.advanceTimersByTime(170_000)
      await Promise.resolve()
    })

    expect(result.current.token).toBeNull()
    expect(result.current.warning).toBe('Backend unavailable')
  })
})
