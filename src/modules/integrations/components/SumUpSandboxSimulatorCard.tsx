import { useEffect, useMemo, useState } from 'react'
import { Badge, Button } from '../../../components/ui'
import { useSumUpConnection } from '../hooks/useSumUpConnection'
import { showToast } from '../../../shared/stores/toastStore'
import { supabase } from '../../../shared/lib/supabaseClient'
import { config } from '../../../shared/lib/env'

type Props = {
  userId: string
}

type SimulationResult = {
  mode?: string
  environment?: 'sandbox'
  token_source?: string
  merchant_code?: string
  checkout_id?: string
  checkout_status?: string
  transaction_code?: string | null
  transaction_id?: string | null
  found_in_history?: boolean
  history_items?: number
  history?: {
    items?: HistoryItem[]
  }
  error?: string
  message?: string
  next_step?: unknown
}

type HistoryItem = {
  id?: string
  transaction_code?: string
  timestamp?: string
  amount?: number
  currency?: string
  status?: string
  payment_type?: string
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Erreur inconnue pendant la simulation sandbox'
}

function normalizeSandboxError(message: string): string {
  if (message.includes('No SumUp integration found')) {
    return 'Aucune connexion SumUp trouvée pour ce compte. Connectez SumUp ou configurez la clé sandbox serveur.'
  }
  if (message.includes('Unauthorized') || message.includes('401')) {
    return 'Session expirée ou invalide. Déconnectez-vous puis reconnectez-vous avant de relancer la simulation.'
  }
  if (message.includes('missing_payments_scope')) {
    return 'La simulation sandbox nécessite une clé serveur SUMUP_SANDBOX_API_KEY côté serveur.'
  }
  return message
}

async function getAccessTokenOrThrow(forceRefresh = false): Promise<string> {
  const isTokenAboutToExpire = (token: string, bufferSeconds = 60): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number }
      const exp = typeof payload.exp === 'number' ? payload.exp : 0
      return exp - Math.floor(Date.now() / 1000) < bufferSeconds
    } catch {
      return true
    }
  }

  const isLikelyJwt = (token: string): boolean => /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(token)

  if (forceRefresh) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    const refreshedToken = refreshed.session?.access_token
    if (refreshedToken && isLikelyJwt(refreshedToken) && !isTokenAboutToExpire(refreshedToken)) {
      return refreshedToken
    }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const cachedToken = sessionData.session?.access_token
  if (cachedToken && isLikelyJwt(cachedToken) && !isTokenAboutToExpire(cachedToken)) {
    return cachedToken
  }

  const { data: refreshed } = await supabase.auth.refreshSession()
  const token = refreshed.session?.access_token
  if (!token || !isLikelyJwt(token) || isTokenAboutToExpire(token)) {
    throw new Error('Session expirée, veuillez vous reconnecter')
  }

  return token
}

function formatTimestamp(value?: string): string {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('fr-FR')
}

function statusToBadgeVariant(status?: string): 'default' | 'success' | 'warning' | 'info' {
  const normalized = String(status ?? '').toUpperCase()
  if (normalized === 'SUCCESSFUL') return 'success'
  if (normalized === 'PENDING') return 'warning'
  if (normalized === 'FAILED' || normalized === 'CANCELLED' || normalized === 'CHARGE_BACK') return 'default'
  return 'info'
}

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  // Fallback for older contexts where Clipboard API is unavailable.
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export function SumUpSandboxSimulatorCard({ userId }: Props) {
  const {
    connectionStatus,
    merchantCode: connectedMerchantCode,
    sandboxMerchantCode,
    saveSandboxMerchantCode,
  } = useSumUpConnection(userId)
  const [amount, setAmount] = useState('12.34')
  const [currency, setCurrency] = useState('EUR')
  const [merchantCode, setMerchantCode] = useState('')
  const [historyOnly, setHistoryOnly] = useState(false)
  const [historyLimit, setHistoryLimit] = useState('10')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingMerchantCode, setIsSavingMerchantCode] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)

  const historyItems = (result?.history?.items ?? []).slice(0, 10)
  const preferredMerchantCode = useMemo(
    () => sandboxMerchantCode ?? connectedMerchantCode ?? null,
    [sandboxMerchantCode, connectedMerchantCode],
  )
  const normalizedInputMerchantCode = merchantCode.trim()
  const normalizedStoredSandboxCode = sandboxMerchantCode?.trim() ?? ''
  const canPersistMerchantCode = normalizedInputMerchantCode !== normalizedStoredSandboxCode

  useEffect(() => {
    if (preferredMerchantCode && !merchantCode.trim()) {
      setMerchantCode(preferredMerchantCode)
    }
  }, [preferredMerchantCode])

  if (!userId) return null

  const persistMerchantCode = async () => {
    setIsSavingMerchantCode(true)
    try {
      const persistenceMode = await saveSandboxMerchantCode(merchantCode)
      showToast(
        persistenceMode === 'remote'
          ? 'Merchant code sandbox enregistré pour ce marchand.'
          : 'Merchant code sandbox enregistré localement sur cet appareil.',
        'success',
      )
    } catch (error) {
      showToast(toErrorMessage(error), 'error')
    } finally {
      setIsSavingMerchantCode(false)
    }
  }

  const runSimulation = async () => {
    setIsSubmitting(true)
    try {
      const callSimulation = async (token: string) => fetch(`${config.supabaseUrl}/functions/v1/sumup-sandbox-simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          authorization: `Bearer ${token}`,
          apikey: config.supabaseAnonKey,
        },
        body: JSON.stringify({
          amount: Number(amount),
          currency: currency.trim().toUpperCase(),
          merchant_code: merchantCode.trim() || undefined,
          history_limit: Number(historyLimit) || 10,
          history_only: historyOnly,
          access_token: token,
        }),
      })

      let token = await getAccessTokenOrThrow(false)
      let response = await callSimulation(token)
      let payload = await response.json().catch(() => ({})) as SimulationResult

      const authError = `${payload.error ?? payload.message ?? ''}`
      const shouldRetryAuth = response.status === 401 && (
        authError.includes('Missing authorization header')
        || authError.includes('Invalid JWT')
        || authError.includes('Unauthorized')
      )

      if (shouldRetryAuth) {
        token = await getAccessTokenOrThrow(true)
        response = await callSimulation(token)
        payload = await response.json().catch(() => ({})) as SimulationResult
      }

      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? `Erreur ${response.status}`)
      }

      setResult(payload)
      if (payload.merchant_code && !merchantCode.trim()) {
        setMerchantCode(payload.merchant_code)
      }
      if (payload.error) {
        showToast(payload.error, 'error')
      } else {
        showToast('Simulation sandbox exécutée.', 'success')
      }
    } catch (error) {
      const message = normalizeSandboxError(toErrorMessage(error))
      setResult({ error: message })
      showToast(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyTransactionCode = async (code?: string | null) => {
    if (!code) return
    try {
      await copyToClipboard(code)
      showToast(`Code transaction copié: ${code}`, 'success')
    } catch {
      showToast('Impossible de copier le code transaction', 'error')
    }
  }

  return (
    <section className="rounded-lg border border-[#FFE1D6] bg-[#FFF8F4] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase tracking-[0.16em] text-[#B7592C]">Simulation SumUp</p>
          <h2 className="mt-2 font-display text-base font-semibold text-dark">Tester les transactions en sandbox</h2>
          <p className="mt-1 font-body text-sm text-gray-600">
            Cette interface lance uniquement des simulations sandbox.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Badge variant="warning">Mode actif: Sandbox</Badge>
      </div>

      <p className="mt-2 text-xs text-gray-600">
        Sandbox uniquement: la simulation utilise la clé serveur SUMUP_SANDBOX_API_KEY.
      </p>

      <div className="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Pré-requis</p>
        <p className="mt-1 text-sm text-gray-700">
          Cette carte exige une clé serveur sandbox côté Supabase.
        </p>
        {preferredMerchantCode && (
          <p className="mt-2 text-xs text-gray-500">
            Code détecté par défaut: <strong className="text-gray-800">{preferredMerchantCode}</strong>
            {sandboxMerchantCode
              ? ' (enregistré pour la sandbox)'
              : connectedMerchantCode
                ? ' (repris depuis la connexion SumUp)'
                : ''}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-gray-700" htmlFor="sumup-sim-amount">Montant</label>
          <input
            id="sumup-sim-amount"
            type="number"
            min="0.1"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-700" htmlFor="sumup-sim-currency">Devise</label>
          <input
            id="sumup-sim-currency"
            type="text"
            maxLength={3}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-700" htmlFor="sumup-sim-merchant-code">Merchant code sandbox (optionnel)</label>
          <input
            id="sumup-sim-merchant-code"
            type="text"
            value={merchantCode}
            onChange={(event) => setMerchantCode(event.target.value)}
            placeholder="Ex: MWHAVKDV"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="soft"
              size="sm"
              loading={isSavingMerchantCode}
              disabled={!canPersistMerchantCode}
              onClick={() => void persistMerchantCode()}
            >
              {normalizedInputMerchantCode ? 'Enregistrer le code sandbox' : 'Effacer le code enregistré'}
            </Button>
            {sandboxMerchantCode && <Badge variant="info">Code sandbox enregistré</Badge>}
            {!sandboxMerchantCode && connectedMerchantCode && <Badge variant="warning">Code repris depuis SumUp</Badge>}
            {connectionStatus !== 'connected' && !sandboxMerchantCode && (
              <span className="text-xs text-gray-500">Sans connexion SumUp active, le code est conservé localement sur cet appareil.</span>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-700" htmlFor="sumup-sim-history-limit">Nombre d'éléments history</label>
          <input
            id="sumup-sim-history-limit"
            type="number"
            min="1"
            max="50"
            value={historyLimit}
            onChange={(event) => setHistoryLimit(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={historyOnly}
          onChange={(event) => setHistoryOnly(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        Lecture seule de transactions.history (sans créer de checkout)
      </label>

      <div className="mt-4">
        <Button variant="primary" size="sm" loading={isSubmitting} onClick={() => void runSimulation()}>
          {historyOnly ? 'Lire transactions.history (sandbox)' : 'Lancer simulation sandbox'}
        </Button>
      </div>

      {result && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          {result.error ? (
            <p className="text-sm text-red-700">{result.error}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
              <p><strong>Mode:</strong> {result.mode ?? 'simulate'}</p>
              <p><strong>Environnement:</strong> {result.environment ?? 'sandbox'}</p>
              <p><strong>Token source:</strong> {result.token_source ?? 'unknown'}</p>
              <p><strong>Merchant code:</strong> {result.merchant_code ?? 'n/a'}</p>
              <p>
                <strong>Checkout status:</strong>{' '}
                <Badge variant={statusToBadgeVariant(result.checkout_status)} className="align-middle">
                  {result.checkout_status ?? 'n/a'}
                </Badge>
              </p>
              <p className="flex items-center gap-2">
                <strong>Transaction code:</strong> {result.transaction_code ?? 'n/a'}
                {result.transaction_code && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => void handleCopyTransactionCode(result.transaction_code)}
                  >
                    Copier
                  </Button>
                )}
              </p>
              <p><strong>Trouvée dans history:</strong> {result.found_in_history ? 'oui' : 'non'}</p>
              <p><strong>Items history:</strong> {result.history_items ?? 0}</p>
              <p><strong>Checkout ID:</strong> {result.checkout_id ?? 'n/a'}</p>
            </div>
          )}

          {!result.error && historyItems.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-2 text-sm font-medium text-gray-700">10 dernières transactions history</p>
              <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Code</th>
                    <th className="px-2 py-2 font-medium">Montant</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Statut</th>
                    <th className="px-2 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item, index) => (
                    <tr key={item.id ?? item.transaction_code ?? `${index}`} className="border-b border-gray-100">
                      <td className="whitespace-nowrap px-2 py-2 text-gray-700">{formatTimestamp(item.timestamp)}</td>
                      <td className="whitespace-nowrap px-2 py-2 font-medium text-gray-800">{item.transaction_code ?? 'n/a'}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-700">
                        {typeof item.amount === 'number' ? item.amount.toFixed(2) : 'n/a'} {item.currency ?? ''}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-700">{item.payment_type ?? 'n/a'}</td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <Badge variant={statusToBadgeVariant(item.status)}>{item.status ?? 'UNKNOWN'}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!item.transaction_code}
                          className="h-7 px-2 text-xs"
                          onClick={() => void handleCopyTransactionCode(item.transaction_code)}
                        >
                          Copier
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">Voir la réponse complète</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  )
}
