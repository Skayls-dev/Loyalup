import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export interface QRViewportDecoded {
  merchantId: string
  signature?: string
  networkId?: string | null
  timestamp?: number
  manual?: boolean
}

export interface QRViewportProps {
  onSuccess: (payload: QRViewportDecoded) => void
  onError: (reason: string) => void
}

export function QRViewport({ onSuccess, onError }: QRViewportProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [starting, setStarting] = useState(false)

  const readerId = useMemo(() => `qr-viewport-reader-${Math.random().toString(36).slice(2, 10)}`, [])

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current
      if (!scanner) return

      if (scanner.isScanning) {
        void scanner
          .stop()
          .catch(() => null)
          .finally(() => {
            try {
              scanner.clear()
            } catch {
              null
            }
          })
      } else {
        try {
          scanner.clear()
        } catch {
          null
        }
      }

      scannerRef.current = null
    }
  }, [])

  const startCamera = async () => {
    if (starting || isScanning) return

    setStarting(true)

    try {
      const scanner = new Html5Qrcode(readerId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 210, height: 210 },
        },
        async (decodedText, result) => {
          try {
            const raw = result?.decodedText ?? decodedText
            const decoded = JSON.parse(raw) as Record<string, unknown>

            if (!decoded.merchantId || !decoded.signature) {
              onError('invalid')
              return
            }

            await scanner.stop().catch(() => null)
            try {
              scanner.clear()
            } catch {
              null
            }
            scannerRef.current = null
            setIsScanning(false)

            onSuccess({
              merchantId: String(decoded.merchantId),
              signature: String(decoded.signature),
              networkId: typeof decoded.networkId === 'string' ? decoded.networkId : null,
              timestamp: typeof decoded.timestamp === 'number' ? decoded.timestamp : undefined,
            })
          } catch {
            onError('invalid')
          }
        },
        () => null,
      )

      setIsScanning(true)
    } catch {
      onError('camera')
      setIsScanning(false)
    } finally {
      setStarting(false)
    }
  }

  const submitManual = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = manualCode.trim()
    if (!code) {
      onError('invalid')
      return
    }

    onSuccess({ merchantId: code, manual: true })
    setManualCode('')
  }

  return (
    <div className="space-y-3">
      <div className="scanner-shell relative mx-auto h-[240px] w-[240px] overflow-hidden rounded-[20px] bg-[#0A0A0F]">
        <div id={readerId} className="h-full w-full" />

        <div className="scanner-corners pointer-events-none absolute inset-0" />
        <div className="scanner-corners-bottom pointer-events-none absolute inset-0" />
        <div className={`scanner-line pointer-events-none absolute left-4 right-4 h-[3px] ${isScanning ? 'opacity-100' : 'opacity-0'}`} />

        <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          <span className="scanner-dot scanner-dot-1" />
          <span className="scanner-dot scanner-dot-2" />
          <span className="scanner-dot scanner-dot-3" />
        </div>
      </div>

      <p className="text-center font-body text-sm text-gray-600">Positionnez le QR code dans le cadre</p>

      <button
        type="button"
        onClick={startCamera}
        disabled={starting || isScanning}
        className="h-11 w-full rounded-md bg-primary font-body text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
      >
        ⊙ Activer la caméra
      </button>

      <form onSubmit={submitManual} className="flex items-center gap-2">
        <input
          type="text"
          value={manualCode}
          onChange={(event) => setManualCode(event.target.value)}
          placeholder="Code marchand"
          className="h-10 flex-1 rounded-md border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-dark transition hover:border-primary hover:text-primary"
          aria-label="Soumettre le code marchand"
        >
          →
        </button>
      </form>

      <style>{`
        .scanner-corners::before,
        .scanner-corners::after,
        .scanner-corners-bottom::before,
        .scanner-corners-bottom::after {
          content: '';
          position: absolute;
          width: 36px;
          height: 36px;
          border-color: #5B4FE8;
          border-style: solid;
          animation: qr-corner-pulse 1.4s ease-in-out infinite;
        }

        .scanner-corners::before {
          top: 12px;
          left: 12px;
          border-width: 3px 0 0 3px;
          border-radius: 12px 0 0 0;
        }

        .scanner-corners::after {
          top: 12px;
          right: 12px;
          border-width: 3px 3px 0 0;
          border-radius: 0 12px 0 0;
        }

        .scanner-corners-bottom::before {
          bottom: 12px;
          left: 12px;
          border-width: 0 0 3px 3px;
          border-radius: 0 0 0 12px;
        }

        .scanner-corners-bottom::after {
          bottom: 12px;
          right: 12px;
          border-width: 0 3px 3px 0;
          border-radius: 0 0 12px 0;
        }

        .scanner-line {
          top: 14px;
          background: linear-gradient(90deg, rgba(91,79,232,0), rgba(91,79,232,0.95), rgba(91,79,232,0));
          box-shadow: 0 0 16px rgba(91,79,232,0.7);
          animation: qr-scan-line 2s linear infinite;
        }

        .scanner-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #5B4FE8;
          box-shadow: 0 0 10px rgba(91,79,232,0.9);
          opacity: 0.4;
          animation: qr-dot-pulse 1.2s ease-in-out infinite;
        }

        .scanner-dot-2 {
          animation-delay: 0.2s;
        }

        .scanner-dot-3 {
          animation-delay: 0.4s;
        }

        @keyframes qr-scan-line {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(208px);
          }
        }

        @keyframes qr-dot-pulse {
          0%,
          100% {
            transform: scale(0.9);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }

        @keyframes qr-corner-pulse {
          0%,
          100% {
            opacity: 0.75;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
