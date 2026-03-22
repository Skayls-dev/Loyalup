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
  | 'FREE_REDEMPTION_DISABLED'
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

    return json(
      {
        success: false,
        error: 'FREE_REDEMPTION_DISABLED',
        code: 'FREE_REDEMPTION_DISABLED',
        message: 'Point redemption is disabled. Only unlocked existing offers can be consumed.',
      },
      403,
    )
})
