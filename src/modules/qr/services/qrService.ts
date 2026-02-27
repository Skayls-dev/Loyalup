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

let pendingTransactionsChannel: ReturnType<typeof supabase.channel> | null = null

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
      throw new Error(error.message)
    }

    if (!data?.token || !data.expires_at) {
      throw new Error('Invalid generate token response')
    }

    return data
  } catch (error) {
    const status = extractHttpStatus(error)
    const message =
      status !== null
        ? `Unable to generate QR token (HTTP ${status})`
        : error instanceof Error
          ? error.message
          : 'Unable to generate QR token'
    throw new Error(message)
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
      throw new Error(error.message)
    }

    if (!data?.success || !data.fournisseur_id || !data.transaction_id) {
      throw new Error('Invalid validate token response')
    }

    return data
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to validate QR token'
    throw new Error(message)
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
