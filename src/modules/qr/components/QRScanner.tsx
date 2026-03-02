import { useEffect } from 'react'
import { ArrowLeft, CheckCircle2, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQRScan } from '../hooks/useQRScan'

export function QRScanner() {
  const navigate = useNavigate()
  const { startScan, stopScan, scanning, success, error, transactionId, transactionStatus } = useQRScan()

  useEffect(() => {
    startScan().catch(() => null)

    return () => {
      stopScan().catch(() => null)
    }
  }, [startScan, stopScan])

  useEffect(() => {
    if (transactionStatus !== 'validated') {
      return
    }

    const timer = window.setTimeout(() => {
      navigate('/client', { replace: true })
    }, 1800)

    return () => {
      window.clearTimeout(timer)
    }
  }, [navigate, transactionStatus])

  const handleRetry = async () => {
    await stopScan()
    await startScan()
  }

  return (
    <section className="relative h-[calc(100vh-5rem)] w-full overflow-hidden bg-zinc-950">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="absolute left-3 top-3 z-20 inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/85 px-3 py-2 text-sm text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <div className="absolute inset-0" id="qr-reader" />

      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div className="relative h-[min(72vw,18rem)] w-[min(72vw,18rem)]">
          <span className="absolute left-0 top-0 h-10 w-10 border-l-4 border-t-4 border-zinc-100" />
          <span className="absolute right-0 top-0 h-10 w-10 border-r-4 border-t-4 border-zinc-100" />
          <span className="absolute bottom-0 left-0 h-10 w-10 border-b-4 border-l-4 border-zinc-100" />
          <span className="absolute bottom-0 right-0 h-10 w-10 border-b-4 border-r-4 border-zinc-100" />
          <span className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-teal-400/80 shadow-[0_0_14px_2px_rgba(45,212,191,0.7)]" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-zinc-800 bg-zinc-900/90 p-4 text-zinc-100 backdrop-blur">
        {success && transactionStatus === 'validated' ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-700 bg-emerald-950/60 p-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-300">Scan validé</p>
              <p className="text-xs text-emerald-200/90">Points crédités sur votre compte.</p>
              <p className="text-xs text-emerald-200/70">Retour au tableau de bord...</p>
            </div>
          </div>
        ) : success && transactionStatus === 'cancelled' ? (
          <div className="space-y-3 rounded-xl border border-red-800 bg-red-950/60 p-3">
            <p className="text-sm text-red-300">Validation refusée par le commerçant.</p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Scanner un autre QR
            </button>
          </div>
        ) : success ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-700 bg-emerald-950/60 p-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-300">Transaction en attente</p>
              <p className="text-xs text-emerald-200/90">En attente de validation commerçant...</p>
              <p className="text-xs text-emerald-200/70">ID: {transactionId}</p>
            </div>
          </div>
        ) : error ? (
          <div className="space-y-3 rounded-xl border border-red-800 bg-red-950/60 p-3">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Réessayer
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-300">{scanning ? 'Scan en cours...' : 'Initialisation caméra...'}</p>
        )}
      </div>
    </section>
  )
}
