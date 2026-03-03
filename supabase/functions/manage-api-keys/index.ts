import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Action = 'CREATE' | 'LIST' | 'REVOKE' | 'ROTATE'

type CreateBody = {
  action: 'CREATE'
  name: string
  environment?: 'sandbox' | 'production'
  scopes?: string[]
  expires_at?: string | null
}

type RevokeBody = {
  action: 'REVOKE'
  key_id: string
}

type RotateBody = {
  action: 'ROTATE'
  key_id: string
  name?: string
}

type ListBody = {
  action: 'LIST'
}

type RequestBody = CreateBody | RevokeBody | RotateBody | ListBody

const ALLOWED_SCOPES = new Set(['read', 'write', 'transactions', 'clients', 'webhooks'])

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
  const pepper = Deno.env.get('API_KEY_PEPPER')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !pepper) {
    return json({ error: 'Missing Supabase env vars or API_KEY_PEPPER' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.replace('Bearer ', '').trim()

  const authClient = createClient(supabaseUrl, anonKey)
  const { data: userResult, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userResult.user?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const providerUserId = userResult.user.id

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body?.action) {
    return json({ error: 'Missing action' }, 400)
  }

  const { data: fournisseur, error: fournisseurError } = await adminClient
    .from('fournisseurs')
    .select('id, tier')
    .eq('user_id', providerUserId)
    .maybeSingle<{ id: string; tier: string }>()

  if (fournisseurError || !fournisseur?.id) {
    return json({ error: 'Provider not found' }, 404)
  }

  const isReadAction = body.action === 'LIST'
  const rateKey = isReadAction ? 'manage_api_keys_list' : 'manage_api_keys_mutation'
  const maxPerHour = isReadAction ? 300 : 30

  const rateOk = await checkActionRateLimit(adminClient, providerUserId, rateKey, maxPerHour)
  if (!rateOk.allowed) {
    return json({ error: 'Rate limit exceeded', retry_after: rateOk.retryAfterSeconds }, 429)
  }

  if (body.action === 'LIST') {
    return await listKeys(adminClient, fournisseur.id)
  }

  if (body.action === 'CREATE') {
    return await createKey(adminClient, pepper, fournisseur.id, fournisseur.tier, body)
  }

  if (body.action === 'REVOKE') {
    return await revokeKey(adminClient, fournisseur.id, body.key_id)
  }

  if (body.action === 'ROTATE') {
    return await rotateKey(adminClient, pepper, fournisseur.id, fournisseur.tier, body)
  }

  return json({ error: 'Unknown action' }, 400)
})

async function listKeys(adminClient: ReturnType<typeof createClient>, fournisseurId: string) {
  const { data, error } = await adminClient
    .from('api_keys')
    .select('id, name, key_prefix, scopes, last_used_at, environment, is_active, expires_at, created_at')
    .eq('fournisseur_id', fournisseurId)
    .order('created_at', { ascending: false })

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({
    success: true,
    keys: data ?? [],
  })
}

async function createKey(
  adminClient: ReturnType<typeof createClient>,
  pepper: string,
  fournisseurId: string,
  tier: string,
  body: CreateBody,
) {
  if (!body.name || body.name.trim().length < 2) {
    return json({ error: 'Invalid key name' }, 400)
  }

  const environment = body.environment ?? 'production'
  const scopes = (body.scopes ?? ['read']).filter((scope) => ALLOWED_SCOPES.has(scope))

  if (scopes.length === 0) {
    return json({ error: 'At least one valid scope is required' }, 400)
  }

  const { data: tierRule, error: tierError } = await adminClient
    .from('rate_limit_rules')
    .select('max_api_keys, sandbox_enabled')
    .eq('tier', tier)
    .single<{ max_api_keys: number; sandbox_enabled: boolean }>()

  if (tierError || !tierRule) {
    return json({ error: 'Tier rule not found' }, 500)
  }

  if (environment === 'sandbox' && !tierRule.sandbox_enabled) {
    return json({ error: 'Sandbox keys are not enabled for this tier' }, 403)
  }

  const nowIso = new Date().toISOString()
  const { count, error: countError } = await adminClient
    .from('api_keys')
    .select('id', { head: true, count: 'exact' })
    .eq('fournisseur_id', fournisseurId)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

  if (countError) {
    return json({ error: countError.message }, 500)
  }

  if ((count ?? 0) >= tierRule.max_api_keys) {
    return json({ error: `Tier limit reached: max ${tierRule.max_api_keys} API keys` }, 403)
  }

  const rawKey = await generateApiKey(environment)
  const keyHash = await sha256Hex(`${rawKey}:${pepper}`)
  const keyPrefix = rawKey.slice(0, 8)

  const { data, error } = await adminClient
    .from('api_keys')
    .insert({
      fournisseur_id: fournisseurId,
      name: body.name.trim(),
      key_hash: keyHash,
      key_prefix: keyPrefix,
      environment,
      scopes,
      expires_at: body.expires_at ?? null,
      is_active: true,
    })
    .select('id, name, key_prefix, scopes, environment, is_active, created_at, expires_at')
    .single()

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({
    success: true,
    key: rawKey,
    key_once: true,
    metadata: data,
  })
}

async function revokeKey(adminClient: ReturnType<typeof createClient>, fournisseurId: string, keyId: string) {
  const { data: existing, error: existingError } = await adminClient
    .from('api_keys')
    .select('id')
    .eq('id', keyId)
    .eq('fournisseur_id', fournisseurId)
    .maybeSingle<{ id: string }>()

  if (existingError) {
    return json({ error: existingError.message }, 500)
  }

  if (!existing?.id) {
    return json({ error: 'API key not found' }, 404)
  }

  const { error } = await adminClient
    .from('api_keys')
    .update({ is_active: false, expires_at: new Date().toISOString() })
    .eq('id', keyId)

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ success: true, revoked: true })
}

async function rotateKey(
  adminClient: ReturnType<typeof createClient>,
  pepper: string,
  fournisseurId: string,
  tier: string,
  body: RotateBody,
) {
  const { data: oldKey, error: oldError } = await adminClient
    .from('api_keys')
    .select('id, name, environment, scopes')
    .eq('id', body.key_id)
    .eq('fournisseur_id', fournisseurId)
    .maybeSingle<{ id: string; name: string; environment: 'sandbox' | 'production'; scopes: string[] }>()

  if (oldError) {
    return json({ error: oldError.message }, 500)
  }

  if (!oldKey?.id) {
    return json({ error: 'API key not found' }, 404)
  }

  const graceUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error: graceError } = await adminClient
    .from('api_keys')
    .update({
      grace_until: graceUntil,
      expires_at: graceUntil,
      is_active: true,
      name: `${oldKey.name} (rotating)`,
    })
    .eq('id', oldKey.id)

  if (graceError) {
    return json({ error: graceError.message }, 500)
  }

  return await createKey(adminClient, pepper, fournisseurId, tier, {
    action: 'CREATE',
    name: body.name?.trim() || oldKey.name,
    environment: oldKey.environment,
    scopes: oldKey.scopes,
  })
}

async function generateApiKey(environment: 'sandbox' | 'production') {
  const prefix = environment === 'sandbox' ? 'lup_test_' : 'lup_live_'
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const random = crypto.getRandomValues(new Uint8Array(32))
  let tail = ''

  for (const value of random) {
    tail += alphabet[value % alphabet.length]
  }

  return `${prefix}${tail}`
}

async function sha256Hex(value: string): Promise<string> {
  const input = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', input)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function checkActionRateLimit(
  adminClient: ReturnType<typeof createClient>,
  providerUserId: string,
  actionKey: string,
  maxPerHour: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date()
  const hourBucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}`
  const hourReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1, 0, 0, 0))

  const { data: row, error: rowError } = await adminClient
    .from('provider_action_limits')
    .select('id, usage_count')
    .eq('provider_user_id', providerUserId)
    .eq('action_key', actionKey)
    .eq('hour_bucket', hourBucket)
    .maybeSingle<{ id: string; usage_count: number }>()

  if (rowError) {
    throw rowError
  }

  if (!row?.id) {
    const { error: insertError } = await adminClient.from('provider_action_limits').insert({
      provider_user_id: providerUserId,
      action_key: actionKey,
      hour_bucket: hourBucket,
      usage_count: 1,
      expires_at: hourReset.toISOString(),
    })

    if (insertError) {
      throw insertError
    }

    return { allowed: true, retryAfterSeconds: 0 }
  }

  const next = Number(row.usage_count ?? 0) + 1
  const { error: updateError } = await adminClient
    .from('provider_action_limits')
    .update({ usage_count: next, expires_at: hourReset.toISOString() })
    .eq('id', row.id)

  if (updateError) {
    throw updateError
  }

  if (next > maxPerHour) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((hourReset.getTime() - now.getTime()) / 1000)),
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
