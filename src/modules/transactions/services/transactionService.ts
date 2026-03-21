import { supabase } from '../../../shared/lib/supabaseClient'
import { requireOnlineForWrite } from '../../../shared/lib/offlineGuard'

export type Service = {
  id: string
  fournisseur_id: string
  nom: string
  emoji: string
  prix_defaut: number | null
  points_defaut: number | null
  points_per_euro: number
  actif: boolean
  created_at: string
}

export type Transaction = {
  id: string
  pending_transaction_id: string
  client_id: string
  fournisseur_id: string
  service_id: string | null
  montant: number
  points_credited: number
  status: 'validated' | 'cancelled'
  created_at: string
}

export type ClientPoints = {
  id: string
  client_id: string
  fournisseur_id: string
  solde: number
  total_visites: number
  created_at: string
  updated_at: string
}

export type CreditPointsParams = {
  pending_transaction_id: string
  service_id?: string
  service_nom_libre?: string
  montant: number
}

export type CreditPointsResponse = {
  success: boolean
  base_points?: number
  points_credited: number
  total_points?: number
  network_bonuses?: Array<{ network_name: string; emoji: string; bonus: number }>
  new_balance: number
  transaction_id: string
}

type ClientPointsCallback = (payload: ClientPoints) => void

let clientPointsChannel: ReturnType<typeof supabase.channel> | null = null

export async function creditPoints(params: CreditPointsParams): Promise<CreditPointsResponse> {
  try {
    requireOnlineForWrite()
    const accessToken = await getAccessTokenOrThrow()

    const { data, error } = await supabase.functions.invoke<CreditPointsResponse>('credit-points', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        pending_transaction_id: params.pending_transaction_id,
        service_id: params.service_id ?? null,
        service_nom_libre: params.service_nom_libre ?? null,
        montant: params.montant,
        access_token: accessToken,
      },
    })

    if (error) {
      throw new Error(await extractFunctionErrorMessage(error, 'Unable to credit points'))
    }

    if (!data?.success || typeof data.points_credited !== 'number' || typeof data.new_balance !== 'number') {
      throw new Error('Invalid credit points response')
    }

    return data
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Unable to credit points'
    throw new Error(message)
  }
}

export async function cancelTransaction(pending_transaction_id: string): Promise<void> {
  try {
    requireOnlineForWrite()

    const { error } = await supabase
      .from('pending_transactions')
      .update({ status: 'cancelled' })
      .eq('id', pending_transaction_id)
      .eq('status', 'pending')

    if (error) {
      throw new Error(error.message)
    }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Unable to cancel transaction'
    throw new Error(message)
  }
}

export async function getProviderTransactions(
  fournisseur_id: string,
  limit = 20,
): Promise<Transaction[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, pending_transaction_id, client_id, fournisseur_id, service_id, montant, points_credited, status, created_at')
      .eq('fournisseur_id', fournisseur_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []) as Transaction[]
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Unable to load transactions'
    throw new Error(message)
  }
}

export async function fetchServices(fournisseur_id: string): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, fournisseur_id, nom, emoji, prix_defaut, points_defaut, points_per_euro, actif, created_at')
      .eq('fournisseur_id', fournisseur_id)
      .eq('actif', true)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []) as Service[]
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Unable to load services'
    throw new Error(message)
  }
}

export function subscribeToClientPoints(
  client_id: string,
  fournisseur_id: string,
  callback: ClientPointsCallback,
): void {
  unsubscribeClientPoints()

  clientPointsChannel = supabase
    .channel(`client-points-${client_id}-${fournisseur_id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'client_points',
        filter: `client_id=eq.${client_id}`,
      },
      (payload) => {
        const row = (payload.new || payload.old) as ClientPoints
        if (row?.fournisseur_id === fournisseur_id) {
          callback(row)
        }
      },
    )
    .subscribe()
}

export function unsubscribeClientPoints(): void {
  if (!clientPointsChannel) {
    return
  }

  supabase.removeChannel(clientPointsChannel)
  clientPointsChannel = null
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

async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== 'object') {
    return fallback
  }

  const maybeContext = (error as { context?: unknown }).context

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
  return message || fallback
}
