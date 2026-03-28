import { useState } from 'react'
import { Button } from '../../../components/ui'
import { showToast } from '../../../shared/stores/toastStore'
import { supabase } from '../../../shared/lib/supabaseClient'
import { config } from '../../../shared/lib/env'

type Props = {
  userId: string
}

type SimulationResult = {
  mode?: string
  token_source?: string
  merchant_code?: string
  checkout_id?: string
  checkout_status?: string
  transaction_code?: string | null
  transaction_id?: string | null
  found_in_history?: boolean
  history_items?: number
  error?: string
  message?: string
  next_step?: unknown
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Erreur inconnue pendant la simulation sandbox'
}

async function getAccessTokenOrThrow(): Promise<string> {
  const { data: refreshed } = await supabase.auth.refreshSession()
  if (refreshed.session?.access_token) return refreshed.session.access_token

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    throw new Error('Session expirée, veuillez vous reconnecter')
  }

  return token
}

export function SumUpSandboxSimulatorCard({ userId }: Props) {
  const [amount, setAmount] = useState('12.34')
  const [currency, setCurrency] = useState('EUR')
  const [merchantCode, setMerchantCode] = useState('')
  const [historyOnly, setHistoryOnly] = useState(false)
  const [historyLimit, setHistoryLimit] = useState('10')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)

  if (!userId) return null

  const runSimulation = async () => {
    setIsSubmitting(true)
    try {
      const token = await getAccessTokenOrThrow()
      const response = await fetch(`${config.supabaseUrl}/functions/v1/sumup-sandbox-simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: config.supabaseAnonKey,
        },
        body: JSON.stringify({
          amount: Number(amount),
          currency: currency.trim().toUpperCase(),
          merchant_code: merchantCode.trim() || undefined,
          history_limit: Number(historyLimit) || 10,
          history_only: historyOnly,
        }),
      })

      const payload = await response.json().catch(() => ({})) as SimulationResult

      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? `Erreur ${response.status}`)
      }

      setResult(payload)
      if (payload.error) {
        showToast(payload.error, 'error')
      } else {
        showToast('Simulation sandbox exécutée.', 'success')
      }
    } catch (error) {
      const message = toErrorMessage(error)
      setResult({ error: message })
      showToast(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-lg border border-[#FFE1D6] bg-[#FFF8F4] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase tracking-[0.16em] text-[#B7592C]">Sandbox SumUp</p>
          <h2 className="mt-2 font-display text-base font-semibold text-dark">Simuler des transactions API</h2>
          <p className="mt-1 font-body text-sm text-gray-600">
            Crée un checkout sandbox, tente un paiement simulé, puis relit transactions.history.
          </p>
        </div>
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
          <label className="mb-1 block text-sm text-gray-700" htmlFor="sumup-sim-merchant-code">Merchant code (optionnel)</label>
          <input
            id="sumup-sim-merchant-code"
            type="text"
            value={merchantCode}
            onChange={(event) => setMerchantCode(event.target.value)}
            placeholder="Ex: MWHAVKDV"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
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
          {historyOnly ? 'Lire transactions.history' : 'Lancer simulation sandbox'}
        </Button>
      </div>

      {result && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          {result.error ? (
            <p className="text-sm text-red-700">{result.error}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
              <p><strong>Mode:</strong> {result.mode ?? 'simulate'}</p>
              <p><strong>Token source:</strong> {result.token_source ?? 'unknown'}</p>
              <p><strong>Merchant code:</strong> {result.merchant_code ?? 'n/a'}</p>
              <p><strong>Checkout status:</strong> {result.checkout_status ?? 'n/a'}</p>
              <p><strong>Transaction code:</strong> {result.transaction_code ?? 'n/a'}</p>
              <p><strong>Trouvée dans history:</strong> {result.found_in_history ? 'oui' : 'non'}</p>
              <p><strong>Items history:</strong> {result.history_items ?? 0}</p>
              <p><strong>Checkout ID:</strong> {result.checkout_id ?? 'n/a'}</p>
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
