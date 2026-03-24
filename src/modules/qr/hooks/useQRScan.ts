import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  subscribeToTransactionStatus,
  unsubscribeTransactionStatus,
  validateToken,
} from '../services/qrService'

type ScanTransactionStatus = 'idle' | 'pending' | 'validated' | 'cancelled'

type UseQRScanResult = {
  startScan: () => Promise<void>
  stopScan: () => Promise<void>
  scanning: boolean
  success: boolean
  error: string | null
  transactionId: string | null
  transactionStatus: ScanTransactionStatus
}

export function useQRScan(): UseQRScanResult {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)
  const [scanning, setScanning] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [transactionStatus, setTransactionStatus] = useState<ScanTransactionStatus>('idle')

  const getQrBoxSize = () => {
    const viewportMin = Math.min(window.innerWidth, window.innerHeight)
    const side = Math.max(220, Math.min(320, Math.round(viewportMin * 0.68)))

    return {
      width: side,
      height: side,
    }
  }

  const stopScan = useCallback(async () => {
    if (isStoppingRef.current) {
      return
    }

    isStoppingRef.current = true
    const scanner = scannerRef.current

    if (!scanner) {
      setScanning(false)
      isStoppingRef.current = false
      return
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
      try {
        await scanner.clear()
      } catch {
        null
      }
    } finally {
      scannerRef.current = null
      setScanning(false)
      isStoppingRef.current = false
    }
  }, [])

  const startScan = useCallback(async () => {
    if (isStartingRef.current || isStoppingRef.current) {
      return
    }

    if (scannerRef.current?.isScanning) {
      setScanning(true)
      setError(null)
      return
    }

    isStartingRef.current = true
    setError(null)
    setSuccess(false)
    setTransactionId(null)
    setTransactionStatus('idle')

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode('qr-reader')
    }

    const scanner = scannerRef.current

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: getQrBoxSize(),
        },
        async (decodedText) => {
          try {
            await stopScan()
            const result = await validateToken(decodedText)
            setSuccess(result.success)
            setTransactionId(result.transaction_id)
            setTransactionStatus(result.success ? 'pending' : 'idle')
          } catch (scanError) {
            const message = scanError instanceof Error ? scanError.message : 'Token validation failed'
            setError(message)
          }
        },
        () => null,
      )

      setScanning(true)
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : 'Unable to start camera'

      if (scannerRef.current?.isScanning) {
        setScanning(true)
        setError(null)
      } else if (!isStoppingRef.current) {
        setError(message)
        setScanning(false)
      }

      const lowerMessage = message.toLowerCase()
      if (lowerMessage.includes('already') || lowerMessage.includes('in progress')) {
        setError(null)
      }
    } finally {
      isStartingRef.current = false
    }
  }, [stopScan])

  useEffect(() => {
    if (!success || !transactionId) {
      return
    }

    let cancelled = false

    const applyStatus = (status: ScanTransactionStatus) => {
      if (cancelled || status === 'idle' || status === 'pending') {
        return
      }

      setTransactionStatus(status)

      unsubscribeTransactionStatus()
    }

    subscribeToTransactionStatus(transactionId, (payload) => {
      applyStatus(payload.status)
    })

    return () => {
      cancelled = true
      unsubscribeTransactionStatus()
    }
  }, [success, transactionId])

  return useMemo(
    () => ({
      startScan,
      stopScan,
      scanning,
      success,
      error,
      transactionId,
      transactionStatus,
    }),
    [startScan, stopScan, scanning, success, error, transactionId, transactionStatus],
  )
}
