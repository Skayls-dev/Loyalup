import { supabase } from '../../../shared/lib/supabaseClient'
import { config } from '../../../shared/lib/env'
import { requireOnlineForWrite } from '../../../shared/lib/offlineGuard'

type GenerateTokenResponse = {
  token: string
  expires_at: string
}

type ValidateTokenResponse = {
  success: boolean
  fournisseur_id: string
  transaction_id: string
}

export type PendingTransactionPayload = {
  id: string
  qr_token_id: string
  client_id: string
  fournisseur_id: string
  status: 'pending' | 'validated' | 'cancelled'
  created_at: string
  expires_at: string
}

type PendingTransactionCallback = (payload: PendingTransactionPayload) => void
type TransactionStatusCallback = (payload: PendingTransactionPayload) => void

let pendingTransactionsChannel: ReturnType<typeof supabase.channel> | null = null
let transactionStatusChannel: ReturnType<typeof supabase.channel> | null = null

export async function generateToken(): Promise<GenerateTokenResponse> {
  try {
    requireOnlineForWrite()
    const accessToken = await getAccessTokenOrThrow()

    const { data, error } = await supabase.functions.invoke<GenerateTokenResponse>('generate-qr', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (error) {
      throw new Error(await extractFunctionErrorMessage(error, 'Unable to generate QR token'))
    }

    if (!data?.token || !data.expires_at) {
      throw new Error('Invalid generate token response')
    }

    return data
  } catch (error) {
    const message = await extractFunctionErrorMessage(error, 'Unable to generate QR token')
    throw new Error(normalizeQrErrorMessage(message))
  }
}

export async function validateToken(token: string): Promise<ValidateTokenResponse> {
  try {
    requireOnlineForWrite()
    const accessToken = await getAccessTokenOrThrow()

    const { data, error } = await supabase.functions.invoke<ValidateTokenResponse>('validate-qr', {
      method: 'POST',
      body: { token },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (error) {
      throw new Error(await extractFunctionErrorMessage(error, 'Unable to validate QR token'))
    }

    if (!data?.success || !data.fournisseur_id || !data.transaction_id) {
      throw new Error('Invalid validate token response')
    }

    return data
  } catch (error) {
    const message = await extractFunctionErrorMessage(error, 'Unable to validate QR token')
    throw new Error(normalizeQrErrorMessage(message))
  }
}

export function subscribeToPendingTransactions(
  fournisseurId: string,
  callback: PendingTransactionCallback,
): void {
  if (shouldSkipRealtimeSubscription(config.supabaseAnonKey)) {
    return
  }

  unsubscribe()

  pendingTransactionsChannel = supabase
    .channel(`pending-transactions-${fournisseurId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pending_transactions',
        filter: `fournisseur_id=eq.${fournisseurId}`,
      },
      (payload) => {
        const newTransaction = payload.new as PendingTransactionPayload
        callback(newTransaction)
      },
    )
    .subscribe()
}

export function unsubscribe(): void {
  if (!pendingTransactionsChannel) {
    return
  }

  supabase.removeChannel(pendingTransactionsChannel)
  pendingTransactionsChannel = null
}

export function subscribeToTransactionStatus(
  transactionId: string,
  callback: TransactionStatusCallback,
): void {
  if (shouldSkipRealtimeSubscription(config.supabaseAnonKey)) {
    return
  }

  unsubscribeTransactionStatus()

  transactionStatusChannel = supabase
    .channel(`pending-transaction-status-${transactionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'pending_transactions',
        filter: `id=eq.${transactionId}`,
      },
      (payload) => {
        const updatedTransaction = payload.new as PendingTransactionPayload
        callback(updatedTransaction)
      },
    )
    .subscribe()
}

export function unsubscribeTransactionStatus(): void {
  if (!transactionStatusChannel) {
    return
  }

  supabase.removeChannel(transactionStatusChannel)
  transactionStatusChannel = null
}

export async function getPendingTransactionStatus(
  transactionId: string,
): Promise<PendingTransactionPayload['status'] | null> {
  const { data, error } = await supabase
    .from('pending_transactions')
    .select('status')
    .eq('id', transactionId)
    .maybeSingle<{ status: PendingTransactionPayload['status'] }>()

  if (error) {
    throw new Error(error.message)
  }

  return data?.status ?? null
}

function isPlaceholderAnonKey(anonKey: string): boolean {
  const normalized = anonKey.trim().toLowerCase()
  return normalized === 'your-local-anon-key' || normalized.includes('placeholder')
}

function shouldSkipRealtimeSubscription(anonKey: string): boolean {
  const mode = import.meta.env.MODE
  if (mode === 'test') {
    return false
  }

  return config.isDevelopment && isPlaceholderAnonKey(anonKey)
}

async function getAccessTokenOrThrow(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(error.message)
  }

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Session expirée, reconnectez-vous.')
  }

  return token
}

function extractHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const maybeContext = (error as { context?: { status?: unknown } }).context
  const status = maybeContext?.status
  return typeof status === 'number' ? status : null
}

async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== 'object') {
    return fallback
  }

  const maybeContext = (error as { context?: unknown }).context
  const status = extractHttpStatus(error)

  if (maybeContext && typeof maybeContext === 'object') {
    const responseLike = maybeContext as {
      clone?: () => unknown
      json?: () => Promise<unknown>
      text?: () => Promise<string>
    }

    const readable =
      typeof responseLike.clone === 'function'
        ? (responseLike.clone() as { json?: () => Promise<unknown>; text?: () => Promise<string> })
        : responseLike

    if (readable && typeof readable.json === 'function') {
      try {
        const payload = await readable.json()
        if (payload && typeof payload === 'object' && 'error' in payload) {
          const detail = (payload as { error?: unknown }).error
          if (typeof detail === 'string' && detail.trim()) {
            return detail.trim()
          }
        }
      } catch {
      }
    }

    if (readable && typeof readable.text === 'function') {
      try {
        const raw = await readable.text()
        if (raw && raw.trim()) {
          return raw.trim()
        }
      } catch {
      }
    }
  }

  const message = error instanceof Error ? error.message : fallback
  if (status !== null && (!message || message === 'Edge Function returned a non-2xx status code')) {
    return `${fallback} (HTTP ${status})`
  }

  return message || fallback
}

function normalizeQrErrorMessage(raw: string): string {
  const message = raw.trim()

  const mappings: Array<[RegExp, string]> = [
    [/^TOKEN_EXPIRED$/i, 'QR expiré. Demandez un nouveau QR.'],
    [/^TOKEN_USED$/i, 'QR déjà utilisé. Demandez un nouveau QR.'],
    [/^ALREADY_SCANNED$/i, 'Vous avez déjà scanné ce commerce aujourd’hui.'],
    [/^Token expired or already used$/i, 'QR expiré ou déjà utilisé. Demandez un nouveau QR.'],
    [/^Client already scanned this provider today$/i, 'Vous avez déjà scanné ce commerce aujourd’hui.'],
    [/^Token not found$/i, 'QR invalide ou introuvable.'],
    [/^Missing token$/i, 'QR invalide.'],
    [/^Unauthorized$/i, 'Session expirée, reconnectez-vous.'],
    [/^Missing or invalid Authorization header$/i, 'Session invalide, reconnectez-vous.'],
    [/^Unable to validate QR token \(HTTP 401\)$/i, 'Session expirée, reconnectez-vous.'],
    [/^Unable to validate QR token \(HTTP 409\)$/i, 'QR expiré ou déjà utilisé. Demandez un nouveau QR.'],
    [/^Unable to validate QR token \(HTTP 404\)$/i, 'QR invalide ou introuvable.'],
  ]

  for (const [pattern, friendly] of mappings) {
    if (pattern.test(message)) {
      return friendly
    }
  }

  return message
}
