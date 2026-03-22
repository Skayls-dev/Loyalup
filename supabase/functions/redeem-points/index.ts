import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RedeemPointsRequest = {
  pending_transaction_id?: string
  redemption_rule_id?: string
  points_to_redeem?: number
}

type ErrorCode =
  | 'INSUFFICIENT_POINTS'
  | 'TRANSACTION_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'RULE_NOT_FOUND'
  | 'TRANSACTION_EXPIRED'

type PendingTransactionRow = {
  id: string
  client_id: string
  fournisseur_id: string
  status: 'pending' | 'validated' | 'cancelled'
  expires_at: string
}

type RedemptionRuleRow = {
  id: string
  fournisseur_id: string
  discount_type: 'fixed' | 'percent'
  discount_value: number | string
  max_discount_eur: number | string | null
  actif: boolean
}

type ProviderRow = {
  id: string
  points_conversion_rate: number | string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function errorResponse(code: ErrorCode, status: number, message?: string) {
  return json(
    {
      success: false,
      error: code,
      code,
      message: message ?? code,
    },
    status,
  )
}

function toPositiveInteger(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

function roundEur(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Missing Supabase environment variables' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('UNAUTHORIZED', 401, 'Missing or invalid Authorization header')
    }

    const jwt = authHeader.replace('Bearer ', '').trim()
    if (!jwt) {
      return errorResponse('UNAUTHORIZED', 401, 'Missing auth token')
    }

    const payload = (await req.json().catch(() => ({}))) as RedeemPointsRequest
    const pendingTransactionId = typeof payload.pending_transaction_id === 'string'
      ? payload.pending_transaction_id.trim()
      : ''
    const redemptionRuleId = typeof payload.redemption_rule_id === 'string'
      ? payload.redemption_rule_id.trim()
      : ''
    const pointsToRedeem = toPositiveInteger(payload.points_to_redeem)

    if (!pendingTransactionId || !pointsToRedeem) {
      return json({ error: 'pending_transaction_id and points_to_redeem (> 0) are required' }, 400)
    }

    const authClient = createClient(supabaseUrl, anonKey)
    const { data: userData, error: userError } = await authClient.auth.getUser(jwt)

    if (userError || !userData.user?.id) {
      return errorResponse('UNAUTHORIZED', 401, 'Unauthorized')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: providerData, error: providerError } = await adminClient
      .from('fournisseurs')
      .select('id, points_conversion_rate')
      .eq('user_id', userData.user.id)
      .maybeSingle<ProviderRow>()

    if (providerError) {
      return json({ error: providerError.message }, 400)
    }

    if (!providerData?.id) {
      return errorResponse('UNAUTHORIZED', 403, 'Provider profile not found')
    }

    const { data: pendingTransaction, error: pendingError } = await adminClient
      .from('pending_transactions')
      .select('id, client_id, fournisseur_id, status, expires_at')
      .eq('id', pendingTransactionId)
      .maybeSingle<PendingTransactionRow>()

    if (pendingError) {
      return json({ error: pendingError.message }, 400)
    }

    if (!pendingTransaction || pendingTransaction.status !== 'pending') {
      return errorResponse('TRANSACTION_NOT_FOUND', 404, 'Pending transaction not found')
    }

    if (pendingTransaction.fournisseur_id !== providerData.id) {
      return errorResponse('UNAUTHORIZED', 403, 'Pending transaction does not belong to this provider')
    }

    const expiresAt = new Date(pendingTransaction.expires_at)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return errorResponse('TRANSACTION_EXPIRED', 409, 'Pending transaction expired')
    }

    let discountApplied = 0

    if (redemptionRuleId) {
      const { data: ruleData, error: ruleError } = await adminClient
        .from('redemption_rules')
        .select('id, fournisseur_id, discount_type, discount_value, max_discount_eur, actif')
        .eq('id', redemptionRuleId)
        .maybeSingle<RedemptionRuleRow>()

      if (ruleError) {
        return json({ error: ruleError.message }, 400)
      }

      if (!ruleData || !ruleData.actif || ruleData.fournisseur_id !== providerData.id) {
        return errorResponse('RULE_NOT_FOUND', 404, 'Redemption rule not found')
      }

      const conversionRate = toPositiveNumber(providerData.points_conversion_rate, 100)
      const baseDiscount = pointsToRedeem / conversionRate
      const discountValue = Number(ruleData.discount_value)

      if (ruleData.discount_type === 'fixed') {
        discountApplied = roundEur(discountValue)
      } else {
        const rawDiscount = baseDiscount * (discountValue / 100)
        const maxDiscount = ruleData.max_discount_eur !== null
          ? roundEur(Number(ruleData.max_discount_eur))
          : null

        discountApplied = maxDiscount !== null
          ? roundEur(Math.min(rawDiscount, maxDiscount))
          : roundEur(rawDiscount)
      }
    } else {
      const conversionRate = toPositiveNumber(providerData.points_conversion_rate, 100)
      discountApplied = roundEur(pointsToRedeem / conversionRate)
    }

    let newBalance: number | null = null
    let clientPointsId: string | null = null

    const { data: pointsRow, error: pointsError } = await adminClient
      .from('client_points')
      .select('id, solde')
      .eq('client_id', pendingTransaction.client_id)
      .eq('fournisseur_id', providerData.id)
      .maybeSingle<{ id: string; solde: number | string }>()

    if (pointsError) {
      return json({ error: pointsError.message }, 400)
    }

    const currentBalance = Number(pointsRow?.solde ?? 0)
    if (!pointsRow?.id || currentBalance < pointsToRedeem) {
      return errorResponse('INSUFFICIENT_POINTS', 409, 'Insufficient points balance')
    }

    const nextBalance = currentBalance - pointsToRedeem
    const { data: guardedUpdate, error: guardedUpdateError } = await adminClient
      .from('client_points')
      .update({ solde: nextBalance, updated_at: new Date().toISOString() })
      .eq('id', pointsRow.id)
      .eq('solde', currentBalance)
      .select('id, solde')
      .maybeSingle<{ id: string; solde: number | string }>()

    if (guardedUpdateError) {
      return json({ error: guardedUpdateError.message }, 400)
    }

    if (!guardedUpdate?.id) {
      return errorResponse('INSUFFICIENT_POINTS', 409, 'Insufficient points balance')
    }

    clientPointsId = guardedUpdate.id
    newBalance = Number(guardedUpdate.solde ?? 0)

    const { error: redemptionInsertError } = await adminClient
      .from('redemptions')
      .insert({
        client_id: pendingTransaction.client_id,
        fournisseur_id: providerData.id,
        redemption_rule_id: redemptionRuleId || null,
        points_deducted: pointsToRedeem,
        discount_applied: discountApplied,
        pending_transaction_id: pendingTransaction.id,
      })

    if (redemptionInsertError) {
      if (clientPointsId) {
        await adminClient
          .from('client_points')
          .update({
            solde: (newBalance ?? 0) + pointsToRedeem,
            updated_at: new Date().toISOString(),
          })
          .eq('id', clientPointsId)
      }

      return json({ error: redemptionInsertError.message }, 500)
    }

    return json({
      success: true,
      points_deducted: pointsToRedeem,
      discount_applied: discountApplied,
      new_balance: newBalance ?? 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return json({ error: message }, 500)
  }
})
