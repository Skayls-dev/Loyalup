import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateToken } from '../services/qrService'

type UseQRGenerateResult = {
  token: string | null
  manualCode: string | null
  expiresAt: string | null
  secondsLeft: number
  isLoading: boolean
  warning: string | null
  regenerateNow: () => Promise<void>
}

type UseQRGenerateOptions = {
  enabled?: boolean
}

const TOKEN_TOTAL_SECONDS = 180
const REGENERATE_INTERVAL_MS = 170_000
const FAST_RETRY_DELAY_MS = 2_000
const MAX_FAST_RETRIES = 5

function getSecondsLeft(expiresAt: string | null): number {
  if (!expiresAt) {
    return 0
  }

  const diffMs = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / 1000))
}

export function useQRGenerate(options: UseQRGenerateOptions = {}): UseQRGenerateResult {
  const enabled = options.enabled ?? true
  const [token, setToken] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(TOKEN_TOTAL_SECONDS)
  const [warning, setWarning] = useState<string | null>(null)

  const expiryTimeoutRef = useRef<number | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)
  const fastRetryCountRef = useRef(0)
  const autoRetryRef = useRef(true)

  const clearExpiryTimeout = () => {
    if (expiryTimeoutRef.current !== null) {
      window.clearTimeout(expiryTimeoutRef.current)
      expiryTimeoutRef.current = null
    }
  }

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }

  const scheduleFastRetry = () => {
    if (!enabled || !autoRetryRef.current) {
      return
    }

    if (fastRetryCountRef.current >= MAX_FAST_RETRIES) {
      return
    }

    clearRetryTimeout()
    fastRetryCountRef.current += 1
    retryTimeoutRef.current = window.setTimeout(() => {
      regenerate().catch(() => null)
    }, FAST_RETRY_DELAY_MS)
  }

  const regenerate = useCallback(async () => {
    if (!enabled) {
      return
    }

    if (!autoRetryRef.current) {
      return
    }

    setIsLoading(true)

    try {
      const data = await generateToken()
      autoRetryRef.current = true
      fastRetryCountRef.current = 0
      setToken(data.token)
      setManualCode(data.manual_code?.trim() ? data.manual_code.trim() : null)
      setExpiresAt(data.expires_at)
      setSecondsLeft(getSecondsLeft(data.expires_at))
      setWarning(null)
      localStorage.setItem('qr:last-token', JSON.stringify(data))

      clearExpiryTimeout()
      clearRetryTimeout()
      const timeoutMs = Math.max(0, new Date(data.expires_at).getTime() - Date.now())
      expiryTimeoutRef.current = window.setTimeout(() => {
        if (autoRetryRef.current) {
          regenerate().catch(() => null)
        }
      }, timeoutMs + 100)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'QR indisponible'

      if (message.includes('HTTP 401') || message.includes('HTTP 403')) {
        autoRetryRef.current = false
        clearExpiryTimeout()
        clearRetryTimeout()
      }

      if (!navigator.onLine) {
        const cached = localStorage.getItem('qr:last-token')
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as { token: string; manual_code?: string | null; expires_at: string }
            setToken(parsed.token)
            setManualCode(parsed.manual_code?.trim() ? parsed.manual_code.trim() : null)
            setExpiresAt(parsed.expires_at)
            setSecondsLeft(getSecondsLeft(parsed.expires_at))
            setWarning('Mode hors ligne: dernier QR affiché')
            return
          } catch {
            null
          }
        }
      }

      // Never keep showing a potentially consumed QR token after an online refresh failure.
      setToken(null)
      setManualCode(null)
      setExpiresAt(null)
      setSecondsLeft(0)

      setWarning(message)

      if (autoRetryRef.current && navigator.onLine) {
        scheduleFastRetry()
      }
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setToken(null)
      setManualCode(null)
      setExpiresAt(null)
      setSecondsLeft(0)
      setIsLoading(false)
      setWarning(null)
      autoRetryRef.current = true
      fastRetryCountRef.current = 0
      clearExpiryTimeout()
      clearRetryTimeout()
      return
    }

    regenerate().catch(() => null)

    const intervalId = window.setInterval(() => {
      if (autoRetryRef.current) {
        regenerate().catch(() => null)
      }
    }, REGENERATE_INTERVAL_MS)

    return () => {
      clearExpiryTimeout()
      clearRetryTimeout()
      window.clearInterval(intervalId)
    }
  }, [enabled, regenerate])

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setSecondsLeft(getSecondsLeft(expiresAt))
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [expiresAt])

  return useMemo(
    () => ({
      token,
      manualCode,
      expiresAt,
      secondsLeft,
      isLoading,
      warning,
      regenerateNow: async () => {
        autoRetryRef.current = true
        fastRetryCountRef.current = 0
        clearRetryTimeout()
        await regenerate()
      },
    }),
    [token, manualCode, expiresAt, secondsLeft, isLoading, warning, regenerate],
  )
}
