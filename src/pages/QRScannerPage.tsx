import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '../modules/auth/hooks/useAuth'
import {
  validateToken,
  subscribeToTransactionStatus,
  unsubscribeTransactionStatus,
  getPendingTransactionStatus,
} from '../modules/qr/services/qrService'
import { supabase } from '../shared/lib/supabaseClient'

export interface ScanResult {
  token: string
  pending_transaction_id: string
  fournisseur_id: string
}

type ScannerState = 'scanning' | 'pending' | 'validated' | 'cancelled' | 'error'

interface QRViewportProps {
  onSuccess: (result: ScanResult) => void
  onError: (reason: string) => void
  disabled?: boolean
}

const PENDING_TIMEOUT_S = 120

interface ScanSuccessProps {
  state: 'pending' | 'validated' | 'cancelled'
  points?: number
  balance?: number
  onReset: () => void
}

interface ScanErrorProps {
  reason: string
  onReset: () => void
}

interface ScanHistoryProps {
  userId: string
}

function QRViewport({ onSuccess, onError, disabled = false }: QRViewportProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const busyRef = useRef(false)
  const [manualToken, setManualToken] = useState('')
  const [cameraReady, setCameraReady] = useState(false)

  const readerId = 'qr-page-reader'

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return

    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
      await scanner.clear()
    } catch {
      null
    } finally {
      scannerRef.current = null
      setCameraReady(false)
    }
  }, [])

  const consumeToken = useCallback(
    async (token: string) => {
      const normalized = token.trim()
      if (!normalized || busyRef.current || disabled) return

      busyRef.current = true

      try {
        const validated = await validateToken(normalized)

        if (!validated.success || !validated.transaction_id || !validated.fournisseur_id) {
          throw new Error('QR invalide ou expire.')
        }

        await stopScanner()

        onSuccess({
          token: normalized,
          pending_transaction_id: validated.transaction_id,
          fournisseur_id: validated.fournisseur_id,
        })
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'QR invalide ou expire.'
        onError(message)
      } finally {
        busyRef.current = false
      }
    },
    [disabled, onError, onSuccess, stopScanner],
  )

  useEffect(() => {
    if (disabled) {
      stopScanner().catch(() => null)
      return
    }

    let cancelled = false

    async function start() {
      if (scannerRef.current || cancelled) return

      const scanner = new Html5Qrcode(readerId)
      scannerRef.current = scanner

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            void consumeToken(decodedText)
          },
          () => null,
        )

        if (!cancelled) {
          setCameraReady(true)
        }
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Impossible de demarrer la camera.'
        onError(message)
      }
    }

    void start()

    return () => {
      cancelled = true
      void stopScanner()
    }
  }, [consumeToken, disabled, onError, stopScanner])

  const submitManual = async (event: React.FormEvent) => {
    event.preventDefault()
    await consumeToken(manualToken)
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
        <div id={readerId} className="aspect-square w-full" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-[70%] w-[70%] rounded-lg border-2 border-white/70" />
        </div>
      </div>

      <p className="font-body text-xs text-gray-500">{cameraReady ? 'Camera active. Visez le QR.' : 'Initialisation de la camera...'}</p>

      <form onSubmit={submitManual} className="flex items-center gap-2">
        <input
          type="text"
          value={manualToken}
          onChange={(event) => setManualToken(event.target.value)}
          placeholder="Entrer un token QR"
          className="h-10 flex-1 rounded-md border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-3 font-body text-sm font-semibold text-white transition hover:brightness-105"
        >
          Valider
        </button>
      </form>
    </div>
  )
}

function PendingCountdown({ onTimeout }: { onTimeout: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(PENDING_TIMEOUT_S)

  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeout()
      return
    }
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [secondsLeft, onTimeout])

  const pct = Math.round((secondsLeft / PENDING_TIMEOUT_S) * 100)
  const isUrgent = secondsLeft <= 30

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-14 w-14">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle
            cx="24" cy="24" r="20" fill="none"
            stroke={isUrgent ? '#f87171' : '#f59e0b'}
            strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-body text-sm font-semibold ${isUrgent ? 'text-red-500' : 'text-amber-700'}`}>
          {secondsLeft}s
        </span>
      </div>
      <p className="font-body text-xs text-amber-600 animate-pulse">En attente du commercant...</p>
    </div>
  )
}

function ScanSuccess({ state, points, balance, onReset }: ScanSuccessProps) {
  if (state === 'pending') {
    return (
      <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="font-display text-lg font-extrabold text-amber-900">QR valide !</p>
        <p className="font-body text-sm text-amber-800">
          Transaction en attente de validation par le commercant.
        </p>
        <PendingCountdown onTimeout={onReset} />
        <button
          type="button"
          onClick={onReset}
          className="w-full h-9 rounded-md border border-amber-300 bg-white px-3 font-body text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          Annuler
        </button>
      </div>
    )
  }

  if (state === 'cancelled') {
    return (
      <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
        <p className="font-display text-lg font-extrabold text-rose-900">Transaction annulee</p>
        <p className="font-body text-sm text-rose-800">Le commercant a refuse la transaction.</p>
        <button
          type="button"
          onClick={onReset}
          className="h-10 rounded-md border border-rose-300 bg-white px-3 font-body text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="font-display text-lg font-extrabold text-emerald-900">Points credites !</p>
      {typeof points === 'number' ? (
        <p className="font-body text-sm text-emerald-800">
          +{points.toLocaleString('fr-FR')} pts ajoutes a votre solde.
        </p>
      ) : null}
      {typeof balance === 'number' ? (
        <p className="font-body text-xs text-emerald-700">
          Nouveau solde: {balance.toLocaleString('fr-FR')} pts
        </p>
      ) : null}
      <button
        type="button"
        onClick={onReset}
        className="h-10 rounded-md border border-emerald-300 bg-white px-3 font-body text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
      >
        Scanner un autre QR
      </button>
    </div>
  )
}

function ScanError({ reason, onReset }: ScanErrorProps) {
  return (
    <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
      <p className="font-display text-lg font-extrabold text-rose-900">QR invalide ou expire</p>
      <p className="font-body text-sm text-rose-800">{reason}</p>
      <button
        type="button"
        onClick={onReset}
        className="h-10 rounded-md border border-rose-300 bg-white px-3 font-body text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
      >
        Reessayer
      </button>
    </div>
  )
}

function ScanHistory({ userId }: ScanHistoryProps) {
  const [rows, setRows] = useState<Array<{ id: string; merchant: string; points: number; created_at: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      setRows([])
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)

      const { data, error } = await supabase
        .from('transactions')
        .select('id, fournisseur_id, points_credited, created_at')
        .eq('client_id', userId)
        .eq('status', 'validated')
        .order('created_at', { ascending: false })
        .limit(6)

      if (cancelled) return

      if (error) {
        setRows([])
        setLoading(false)
        return
      }

      const txRows = (data ?? []) as Array<{
        id: string
        fournisseur_id: string | null
        points_credited: number | null
        created_at: string
      }>

      const providerIds = [...new Set(txRows.map((row) => row.fournisseur_id).filter(Boolean))] as string[]
      const providerRes = providerIds.length
        ? await supabase.from('fournisseurs').select('id, nom_commerce').in('id', providerIds)
        : { data: [], error: null }

      if (cancelled) return

      const merchantById = new Map<string, string>()
      for (const provider of (providerRes.data ?? []) as Array<{ id: string; nom_commerce: string | null }>) {
        merchantById.set(provider.id, provider.nom_commerce?.trim() || 'Marchand')
      }

      setRows(
        txRows.map((row) => ({
          id: row.id,
          merchant: row.fournisseur_id ? merchantById.get(row.fournisseur_id) ?? 'Marchand' : 'Marchand',
          points: Number(row.points_credited ?? 0),
          created_at: row.created_at,
        })),
      )
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">Historique de scan</p>

      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <article key={row.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            <div>
              <p className="font-body text-sm font-semibold text-dark">{row.merchant}</p>
              <p className="font-body text-xs text-gray-500">{new Date(row.created_at).toLocaleString('fr-FR')}</p>
            </div>
            <p className="font-body text-sm font-semibold text-violet-600">+{row.points.toLocaleString('fr-FR')} pts</p>
          </article>
        ))}

        {!loading && rows.length === 0 ? <p className="font-body text-sm text-gray-500">Aucun scan enregistre.</p> : null}
        {loading ? <p className="font-body text-xs text-gray-500">Chargement...</p> : null}
      </div>
    </section>
  )
}

export default function QRScannerPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [state, setState] = useState<ScannerState>('scanning')
  const [pendingTxId, setPendingTxId] = useState<string | null>(null)
  const [validatedPoints, setValidatedPoints] = useState<number | undefined>(undefined)
  const [validatedBalance, setValidatedBalance] = useState<number | undefined>(undefined)
  const [errorReason, setErrorReason] = useState('')

  const handleSuccess = useCallback((result: ScanResult) => {
    setPendingTxId(result.pending_transaction_id)
    setState('pending')
  }, [])

  const handleError = useCallback((reason: string) => {
    setErrorReason(reason || 'QR invalide ou expire.')
    setState('error')
  }, [])

  const resetScanner = useCallback(() => {
    unsubscribeTransactionStatus()
    setPendingTxId(null)
    setValidatedPoints(undefined)
    setValidatedBalance(undefined)
    setErrorReason('')
    setState('scanning')
  }, [])

  // When a pending transaction exists, subscribe to status updates and poll
  useEffect(() => {
    if (!pendingTxId || state !== 'pending') return

    let cancelled = false
    let pollingTimer: ReturnType<typeof setInterval> | null = null

    const applyValidated = async () => {
      if (cancelled) return
      // Fetch points from transactions table
      const { data } = await supabase
        .from('transactions')
        .select('points_credited, client_points:client_points_record(solde)')
        .eq('pending_transaction_id', pendingTxId)
        .maybeSingle()
      if (!cancelled) {
        const row = data as { points_credited: number | null; client_points_record?: { solde: number } | null } | null
        setValidatedPoints(row?.points_credited ?? undefined)
        setState('validated')
        if (pollingTimer) clearInterval(pollingTimer)
        unsubscribeTransactionStatus()
      }
    }

    const applyStatus = (status: string) => {
      if (cancelled) return
      if (status === 'validated') {
        void applyValidated()
      } else if (status === 'cancelled') {
        setState('cancelled')
        if (pollingTimer) clearInterval(pollingTimer)
        unsubscribeTransactionStatus()
      }
    }

    subscribeToTransactionStatus(pendingTxId, (payload) => {
      applyStatus(payload.status)
    })

    pollingTimer = setInterval(() => {
      getPendingTransactionStatus(pendingTxId)
        .then((status) => { if (status) applyStatus(status) })
        .catch(() => null)
    }, 1000)

    return () => {
      cancelled = true
      if (pollingTimer) clearInterval(pollingTimer)
      unsubscribeTransactionStatus()
    }
  }, [pendingTxId, state])

  const stateCard = useMemo(() => {
    if (state === 'pending' || state === 'validated' || state === 'cancelled') {
      return (
        <ScanSuccess
          state={state}
          points={validatedPoints}
          balance={validatedBalance}
          onReset={resetScanner}
        />
      )
    }

    if (state === 'error') {
      return <ScanError reason={errorReason} onReset={resetScanner} />
    }

    return <QRViewport onSuccess={handleSuccess} onError={handleError} />
  }, [errorReason, handleError, handleSuccess, resetScanner, state, validatedBalance, validatedPoints])

  return (
    <main className="mx-auto flex w-full max-w-[420px] flex-col gap-6 px-4 py-6">
      <header className="space-y-2 text-center">
        <h1 className="font-display text-3xl font-extrabold text-dark">Scanner un QR code</h1>
        <p className="font-body text-sm text-gray-600">Scannez un QR pour valider la transaction et crediter les points.</p>
      </header>

      {stateCard}

      <ScanHistory userId={userId} />
    </main>
  )
}
