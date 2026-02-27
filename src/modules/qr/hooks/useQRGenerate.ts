import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateToken } from '../services/qrService'

type UseQRGenerateResult = {
  token: string | null
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
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(TOKEN_TOTAL_SECONDS)
  const [warning, setWarning] = useState<string | null>(null)

  const expiryTimeoutRef = useRef<number | null>(null)
  const autoRetryRef = useRef(true)

  const clearExpiryTimeout = () => {
    if (expiryTimeoutRef.current !== null) {
      window.clearTimeout(expiryTimeoutRef.current)
      expiryTimeoutRef.current = null
    }
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
      setToken(data.token)
      setExpiresAt(data.expires_at)
      setSecondsLeft(getSecondsLeft(data.expires_at))
      setWarning(null)
      localStorage.setItem('qr:last-token', JSON.stringify(data))

      clearExpiryTimeout()
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
      }

      if (!navigator.onLine) {
        const cached = localStorage.getItem('qr:last-token')
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as { token: string; expires_at: string }
            setToken(parsed.token)
            setExpiresAt(parsed.expires_at)
            setSecondsLeft(getSecondsLeft(parsed.expires_at))
            setWarning('Mode hors ligne: dernier QR affiché')
            return
          } catch {
            null
          }
        }
      }

      setWarning(message)
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setToken(null)
      setExpiresAt(null)
      setSecondsLeft(0)
      setIsLoading(false)
      setWarning(null)
      autoRetryRef.current = true
      clearExpiryTimeout()
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
      expiresAt,
      secondsLeft,
      isLoading,
      warning,
      regenerateNow: async () => {
        autoRetryRef.current = true
        await regenerate()
      },
    }),
    [token, expiresAt, secondsLeft, isLoading, warning, regenerate],
  )
}
