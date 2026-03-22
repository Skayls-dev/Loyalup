import { supabase } from '../../../shared/lib/supabaseClient'
import { requireOnlineForWrite } from '../../../shared/lib/offlineGuard'

export type RedemptionRule = {
  id: string
  fournisseur_id: string
  label: string
  points_cost: number
  discount_value: number
  discount_type: 'fixed' | 'percent'
  max_discount_eur: number | null
  actif: boolean
  created_at: string
}

export type RedeemPointsParams = {
  pending_transaction_id: string
  redemption_rule_id?: string
  points_to_redeem: number
}

export type RedeemPointsResponse = {
  success: boolean
  points_deducted: number
  discount_applied: number
  new_balance: number
}

export async function redeemPoints(params: RedeemPointsParams): Promise<RedeemPointsResponse> {
  try {
    requireOnlineForWrite()
    const accessToken = await getAccessTokenOrThrow()

    const { data, error } = await supabase.functions.invoke<RedeemPointsResponse>('redeem-points', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        pending_transaction_id: params.pending_transaction_id,
        redemption_rule_id: params.redemption_rule_id ?? null,
        points_to_redeem: params.points_to_redeem,
      },
    })

    if (error) {
      throw new Error(await extractFunctionErrorMessage(error, 'Unable to redeem points'))
    }

    if (
      !data?.success
      || typeof data.points_deducted !== 'number'
      || typeof data.discount_applied !== 'number'
      || typeof data.new_balance !== 'number'
    ) {
      throw new Error('Invalid redeem points response')
    }

    return data
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Unable to redeem points'
    throw new Error(message)
  }
}

export async function fetchRedemptionRules(fournisseurId: string): Promise<RedemptionRule[]> {
  try {
    const { data, error } = await supabase
      .from('redemption_rules')
      .select('*')
      .eq('fournisseur_id', fournisseurId)
      .eq('actif', true)
      .order('points_cost', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return ((data ?? []) as RedemptionRule[]).map((rule) => ({
      ...rule,
      points_cost: Number(rule.points_cost),
      discount_value: Number(rule.discount_value),
      max_discount_eur: rule.max_discount_eur == null ? null : Number(rule.max_discount_eur),
      actif: Boolean(rule.actif),
    }))
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : 'Unable to load redemption rules'
    throw new Error(message)
  }
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
