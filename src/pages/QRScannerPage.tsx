import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '../modules/auth/hooks/useAuth'
import {
  validateToken,
  subscribeToTransactionStatus,
  unsubscribeTransactionStatus,
  getPendingTransactionStatus,
} from '../modules/qr/services/qrService'
import { getReferralStats, generateReferralLink } from '../modules/gamification/services/gamificationService'
import { upsertMerchantRating } from '../modules/ratings/services/ratingService'
import { supabase } from '../shared/lib/supabaseClient'
import { showToast } from '../shared/stores/toastStore'

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
  shareUrl?: string
  shareMessage?: string
  shareLoading?: boolean
  onRetryShare?: () => Promise<void>
  onReset: () => void
}

interface ScanErrorProps {
  reason: string
  onReset: () => void
}

interface ScanHistoryProps {
  userId: string
}

interface ScanFeedbackModalProps {
  open: boolean
  merchantName: string
  rating: number | null
  submitting: boolean
  error: string | null
  onSelect: (rating: number) => void
  onClose: () => void
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
          placeholder="Entrer le code manuel (6 chiffres)"
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

function ScanSuccess({ state, points, balance, shareUrl, shareMessage, shareLoading = false, onRetryShare, onReset }: ScanSuccessProps) {
  const [showShareActions, setShowShareActions] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)

  const toggleShareActions = () => {
    if (!showShareActions && !shareUrl && onRetryShare) {
      void onRetryShare()
    }
    setShowShareActions((open) => !open)
  }

  const shareText = shareMessage ?? 'Rejoignez-moi sur Looyaal et gagnez un bonus de bienvenue.'

  const shareToWhatsApp = () => {
    if (!shareUrl) return
    const text = encodeURIComponent(`${shareText} ${shareUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const shareBySms = () => {
    if (!shareUrl) return
    const body = encodeURIComponent(`${shareText} ${shareUrl}`)
    window.location.href = `sms:?&body=${body}`
  }

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyNotice('Lien copie.')
    } catch {
      setCopyNotice('Impossible de copier automatiquement.')
    }
    window.setTimeout(() => setCopyNotice(null), 1800)
  }

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

      <div className="rounded-lg border border-emerald-200 bg-white p-3">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Viralite</p>
        <p className="mt-1 font-body text-xs text-gray-600">Invitez un ami juste apres votre scan et boostez votre reseau.</p>

        <button
          type="button"
          onClick={toggleShareActions}
          disabled={shareLoading}
          className="mt-3 h-10 w-full rounded-md bg-emerald-600 px-3 font-body text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {shareLoading ? 'Preparation du lien...' : 'Partage maintenant'}
        </button>

        {showShareActions ? (
          <div className="mt-3 space-y-3">
            {!shareUrl ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                <p className="font-body text-xs text-amber-800">Lien d'invitation indisponible pour le moment.</p>
                <button
                  type="button"
                  onClick={() => {
                    if (onRetryShare) {
                      void onRetryShare()
                    }
                  }}
                  disabled={shareLoading}
                  className="mt-2 h-8 rounded-md border border-amber-300 bg-white px-2 font-body text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                >
                  Reessayer de charger le lien
                </button>
              </div>
            ) : (
              <>
                <p className="font-body text-xs text-gray-600">Message pre-rempli avec votre lien d'invitation:</p>
                <p className="rounded-md border border-gray-200 bg-gray-50 p-2 font-body text-xs text-gray-700">
                  {shareText}
                </p>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={shareToWhatsApp}
                    disabled={!shareUrl}
                    className="h-9 rounded-md border border-emerald-200 bg-emerald-50 px-2 font-body text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={shareBySms}
                    disabled={!shareUrl}
                    className="h-9 rounded-md border border-blue-200 bg-blue-50 px-2 font-body text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyLink()
                    }}
                    disabled={!shareUrl}
                    className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 font-body text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    Copier le lien
                  </button>
                </div>
              </>
            )}

            {copyNotice ? <p className="font-body text-xs text-emerald-700">{copyNotice}</p> : null}
          </div>
        ) : null}
      </div>

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

function ScanFeedbackModal({
  open,
  merchantName,
  rating,
  submitting,
  error,
  onSelect,
  onClose,
}: ScanFeedbackModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl font-extrabold text-dark">Votre avis compte</p>
            <p className="mt-1 font-body text-sm text-gray-600">Comment notez-vous {merchantName} ?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100"
          >
            Plus tard
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2" aria-label="Noter de 1 a 5 etoiles">
          {([1, 2, 3, 4, 5] as const).map((star) => {
            const filled = star <= (rating ?? 0)
            return (
              <button
                key={`feedback-star-${star}`}
                type="button"
                disabled={submitting}
                onClick={() => onSelect(star)}
                className={`text-3xl leading-none transition ${filled ? 'text-amber-500' : 'text-gray-300'} ${submitting ? 'cursor-wait opacity-70' : 'hover:scale-110'}`}
                aria-label={`Noter ${star} sur 5`}
              >
                ★
              </button>
            )
          })}
        </div>

        <p className="mt-3 text-center font-body text-xs text-gray-500">
          {rating ? `Vous avez donne ${rating}/5.` : 'Selectionnez une note rapide en un clic.'}
        </p>

        {error ? <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 font-body text-xs text-rose-700">{error}</p> : null}
      </div>
    </div>
  )
}

export default function QRScannerPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [state, setState] = useState<ScannerState>('scanning')
  const [pendingTxId, setPendingTxId] = useState<string | null>(null)
  const [validatedPoints, setValidatedPoints] = useState<number | undefined>(undefined)
  const [validatedBalance, setValidatedBalance] = useState<number | undefined>(undefined)
  const [scanResultData, setScanResultData] = useState<{
    totalPoints: number
    basePoints: number
    bonusPoints: number
    multiplier: number
    merchantName: string
    networkName: string
    currentPoints: number
    nextThreshold: number
  } | null>(null)
  const lastValidatedNudgeRef = useRef<string | null>(null)
  const [errorReason, setErrorReason] = useState('')
  const [shareUrl, setShareUrl] = useState<string | undefined>(undefined)
  const [shareMessage, setShareMessage] = useState<string>('')
  const [shareLoading, setShareLoading] = useState(false)
  const [validatedTransactionId, setValidatedTransactionId] = useState<string | null>(null)
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)

  void scanResultData

  const feedbackMerchantName = scanResultData?.merchantName ?? 'ce marchand'

  const loadShareLink = useCallback(async () => {
    setShareLoading(true)

    try {
      const stats = await getReferralStats()
      const withLink = stats?.url ? stats : await generateReferralLink()

      const url = withLink?.url ?? ''
      const pointsPart =
        typeof validatedPoints === 'number'
          ? `Je viens de gagner ${validatedPoints} points sur Looyaal.`
          : 'Je viens de valider une transaction sur Looyaal.'
      setShareUrl(url || undefined)
      setShareMessage(`${pointsPart} Rejoignez-moi et gagnez un bonus de bienvenue.`)
    } catch {
      setShareUrl(undefined)
      setShareMessage('Rejoignez-moi sur Looyaal et gagnez un bonus de bienvenue.')
    } finally {
      setShareLoading(false)
    }
  }, [validatedPoints])

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
    setValidatedTransactionId(null)
    setScanResultData(null)
    setErrorReason('')
    setShareUrl(undefined)
    setShareMessage('')
    setShareLoading(false)
    setFeedbackRating(null)
    setFeedbackSubmitting(false)
    setFeedbackError(null)
    setFeedbackModalOpen(false)
    setState('scanning')
  }, [])

  const handleFeedbackSelect = useCallback(async (rating: number) => {
    if (!validatedTransactionId) return

    setFeedbackSubmitting(true)
    setFeedbackError(null)

    try {
      await upsertMerchantRating({ transactionId: validatedTransactionId, rating })
      setFeedbackRating(rating)
      setFeedbackModalOpen(false)
      showToast('Merci pour votre avis !', 'success', 2400)
    } catch (caughtError) {
      setFeedbackError(caughtError instanceof Error ? caughtError.message : 'Impossible d\'enregistrer la note.')
    } finally {
      setFeedbackSubmitting(false)
    }
  }, [validatedTransactionId])

  useEffect(() => {
    if (state !== 'validated') return
    void loadShareLink()
  }, [loadShareLink, state])

  // When a pending transaction exists, subscribe to status updates and poll
  useEffect(() => {
    if (!pendingTxId || state !== 'pending') return

    let cancelled = false
    let pollingTimer: ReturnType<typeof setInterval> | null = null

    const applyValidated = async () => {
      if (cancelled) return

      const { data: txData } = await supabase
        .from('transactions')
        .select('id, points_credited, fournisseur_id, client_id')
        .eq('pending_transaction_id', pendingTxId)
        .maybeSingle()

      const transactionId = (txData as { id?: string | null } | null)?.id ?? null
      const pointsCredited = Number((txData as { points_credited?: number | null } | null)?.points_credited ?? 0)
      const fournisseurId = (txData as { fournisseur_id?: string | null } | null)?.fournisseur_id ?? null
      const clientId = (txData as { client_id?: string | null } | null)?.client_id ?? null

      let merchantName = 'Marchand'
      if (fournisseurId) {
        const { data: fournisseurData } = await supabase
          .from('fournisseurs')
          .select('nom_commerce')
          .eq('id', fournisseurId)
          .maybeSingle()

        merchantName =
          (fournisseurData as { nom_commerce?: string | null } | null)?.nom_commerce?.trim() || 'Marchand'
      }

      let networkName = 'Looyaal'
      let multiplier = 1.0
      if (fournisseurId) {
        const { data: networkMembership } = await supabase
          .from('network_members')
          .select('networks:network_id(name, points_multiplier)')
          .eq('fournisseur_id', fournisseurId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()

        if (networkMembership) {
          const rawNetworks = (networkMembership as { networks?: unknown }).networks
          const network = Array.isArray(rawNetworks) ? rawNetworks[0] : rawNetworks

          if (network && typeof network === 'object') {
            const rawName = (network as { name?: unknown }).name
            networkName =
              typeof rawName === 'string'
                ? rawName
                : ((rawName as { fr?: string } | undefined)?.fr ?? 'Looyaal')
            multiplier = Number((network as { points_multiplier?: number | null }).points_multiplier ?? 1)
          }
        }
      }

      const basePoints = multiplier > 1 ? Math.round(pointsCredited / multiplier) : pointsCredited
      const bonusPoints = pointsCredited - basePoints

      let currentPoints = pointsCredited
      let nextThreshold = 1000

      if (clientId && fournisseurId) {
        const { data: clientPointsData } = await supabase
          .from('client_points')
          .select('solde')
          .eq('client_id', clientId)
          .eq('fournisseur_id', fournisseurId)
          .maybeSingle()

        currentPoints = Number((clientPointsData as { solde?: number | null } | null)?.solde ?? pointsCredited)
      }

      if (fournisseurId) {
        const { data: rewardRules } = await supabase
          .from('reward_rules')
          .select('points_required')
          .eq('fournisseur_id', fournisseurId)
          .eq('actif', true)
          .order('points_required', { ascending: true })

        const nextRule = ((rewardRules ?? []) as Array<{ points_required?: number | null }>).find(
          (rule) => Number(rule.points_required) > currentPoints,
        )

        if (nextRule) {
          nextThreshold = Number(nextRule.points_required)
        }
      }

      if (!cancelled) {
        const nudgeKey = `${pendingTxId}:${pointsCredited}:${currentPoints}`
        if (lastValidatedNudgeRef.current !== nudgeKey) {
          lastValidatedNudgeRef.current = nudgeKey
          const remainingToNext = Math.max(0, nextThreshold - currentPoints)
          const message =
            remainingToNext > 0
              ? `Scan validé · +${pointsCredited} pts · Encore ${remainingToNext} pts vers la prochaine récompense`
              : `Scan validé · +${pointsCredited} pts`
          showToast(message, 'success', 3200)
        }

        setValidatedPoints(pointsCredited)
        setValidatedBalance(currentPoints)
        setValidatedTransactionId(transactionId)
        setFeedbackRating(null)
        setFeedbackError(null)
        setFeedbackModalOpen(Boolean(transactionId))
        setScanResultData({
          totalPoints: pointsCredited,
          basePoints,
          bonusPoints,
          multiplier,
          merchantName,
          networkName,
          currentPoints,
          nextThreshold,
        })
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
          shareUrl={shareUrl}
          shareMessage={shareMessage}
          shareLoading={shareLoading}
          onRetryShare={loadShareLink}
          onReset={resetScanner}
        />
      )
    }

    if (state === 'error') {
      return <ScanError reason={errorReason} onReset={resetScanner} />
    }

    return <QRViewport onSuccess={handleSuccess} onError={handleError} />
  }, [
    errorReason,
    handleError,
    handleSuccess,
    resetScanner,
    shareLoading,
    shareMessage,
    shareUrl,
    loadShareLink,
    state,
    validatedBalance,
    validatedPoints,
  ])

  return (
    <main className="mx-auto flex w-full max-w-[420px] flex-col gap-6 px-4 py-6">
      <header className="space-y-2 text-center">
        <h1 className="font-display text-3xl font-extrabold text-dark">Scanner un QR code</h1>
        <p className="font-body text-sm text-gray-600">Scannez un QR pour valider la transaction et crediter les points.</p>
      </header>

      {stateCard}

      <ScanFeedbackModal
        open={state === 'validated' && feedbackModalOpen}
        merchantName={feedbackMerchantName}
        rating={feedbackRating}
        submitting={feedbackSubmitting}
        error={feedbackError}
        onSelect={(rating) => {
          void handleFeedbackSelect(rating)
        }}
        onClose={() => setFeedbackModalOpen(false)}
      />

      <ScanHistory userId={userId} />
    </main>
  )
}
