// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

type IdentityStatus = 'pending_verification' | 'resolved' | 'conflict' | 'merged' | 'rejected'

type IdentityRow = {
  partner_id: string
  external_user_id: string
  loyalup_user_id: string
  link_status: string | null
  link_method: string | null
  verified_at: string | null
  last_status_change_at: string | null
  link_conflict_reason: string | null
  open_case_id: string | null
  case_status: string | null
  case_decision: string | null
  case_conflict_reason: string | null
  case_updated_at: string | null
  current_status: IdentityStatus
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Missing env vars' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: userResult, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userResult.user?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const userId = userResult.user.id

  const { data, error } = await admin
    .from('partner_identity_status')
    .select('partner_id, external_user_id, loyalup_user_id, link_status, link_method, verified_at, last_status_change_at, link_conflict_reason, open_case_id, case_status, case_decision, case_conflict_reason, case_updated_at, current_status')
    .eq('loyalup_user_id', userId)
    .order('last_status_change_at', { ascending: false })

  if (error) {
    return json({ error: error.message }, 500)
  }

  const rows = (data ?? []) as IdentityRow[]
  const counts = rows.reduce<Record<IdentityStatus, number>>(
    (acc, row) => {
      acc[row.current_status] = (acc[row.current_status] ?? 0) + 1
      return acc
    },
    {
      pending_verification: 0,
      resolved: 0,
      conflict: 0,
      merged: 0,
      rejected: 0,
    },
  )

  return json({
    success: true,
    identities: rows,
    summary: {
      total: rows.length,
      statuses: counts,
      has_unresolved: counts.pending_verification > 0 || counts.conflict > 0,
    },
  })
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
