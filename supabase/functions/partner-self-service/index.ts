import { createClient } from 'npm:@supabase/supabase-js@2'

type Action = 'GET_PROFILE' | 'LIST_KEYS' | 'CREATE_KEY' | 'REQUEST_PRODUCTION_ACCESS' | 'LIST_REQUESTS'

type RequestBody = {
  action?: Action
  environment?: 'sandbox' | 'production'
  scopes?: string[]
  expires_at?: string | null
  notes?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_SCOPES = new Set(['transfers:write', 'transfers:read'])

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
  const pepper = Deno.env.get('PARTNER_API_KEY_PEPPER') ?? Deno.env.get('API_KEY_PEPPER')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !pepper) {
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

  const { data: fournisseur, error: fournisseurError } = await admin
    .from('fournisseurs')
    .select('id, nom_commerce')
    .eq('user_id', userId)
    .maybeSingle<{ id: string; nom_commerce: string }>()

  if (fournisseurError || !fournisseur?.id) {
    return json({ error: 'Provider not found' }, 404)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const action = body.action
  if (!action) {
    return json({ error: 'Missing action' }, 400)
  }

  const partner = await resolveOrCreatePartner(admin, {
    fournisseurId: fournisseur.id,
    providerDisplayName: fournisseur.nom_commerce,
    userId,
  })

  if (!partner) {
    return json({ error: 'Failed to resolve partner profile' }, 500)
  }

  if (action === 'GET_PROFILE') {
    return json({
      success: true,
      partner,
      can_use_production: partner.status === 'production_active',
    })
  }

  if (action === 'LIST_KEYS') {
    const { data, error } = await admin
      .from('partner_api_credentials')
      .select('id, partner_id, key_prefix, environment, scopes, is_active, expires_at, last_used_at, created_at')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, keys: data ?? [] })
  }

  if (action === 'CREATE_KEY') {
    const environment = body.environment ?? 'sandbox'
    const requestedScopes = Array.isArray(body.scopes) ? body.scopes : ['transfers:write']
    const scopes = requestedScopes.map((scope) => String(scope).trim()).filter((scope) => ALLOWED_SCOPES.has(scope))

    if (!['sandbox', 'production'].includes(environment)) {
      return json({ error: 'Invalid environment' }, 400)
    }

    if (scopes.length === 0) {
      return json({ error: 'At least one valid scope is required' }, 400)
    }

    if (environment === 'production' && partner.status !== 'production_active') {
      return json({ error: 'Production access not approved yet' }, 403)
    }

    const rawKey = generatePartnerApiKey(environment)
    const keyPrefix = rawKey.slice(0, 12)
    const keyHash = await sha256Hex(`${rawKey}:${pepper}`)

    const { data, error } = await admin
      .from('partner_api_credentials')
      .insert({
        partner_id: partner.id,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        environment,
        scopes,
        is_active: true,
        expires_at: body.expires_at ?? null,
      })
      .select('id, partner_id, key_prefix, environment, scopes, is_active, expires_at, created_at, last_used_at')
      .limit(1)

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({
      success: true,
      key: rawKey,
      key_once: true,
      credential: data?.[0] ?? null,
    })
  }

  if (action === 'REQUEST_PRODUCTION_ACCESS') {
    if (partner.status === 'production_active') {
      return json({ success: true, already_active: true })
    }

    const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null

    const { data, error } = await admin
      .from('partner_access_requests')
      .insert({
        partner_id: partner.id,
        fournisseur_id: fournisseur.id,
        requested_environment: 'production',
        status: 'pending',
        notes,
      })
      .select('id, status, created_at, notes')
      .limit(1)

    if (error) {
      if (error.code === '23505') {
        return json({ error: 'A pending request already exists' }, 409)
      }
      return json({ error: error.message }, 500)
    }

    return json({ success: true, request: data?.[0] ?? null })
  }

  if (action === 'LIST_REQUESTS') {
    const { data, error } = await admin
      .from('partner_access_requests')
      .select('id, status, requested_environment, notes, reviewed_by, reviewed_at, created_at')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, requests: data ?? [] })
  }

  return json({ error: 'Unsupported action' }, 400)
})

async function resolveOrCreatePartner(
  admin: ReturnType<typeof createClient>,
  params: {
    fournisseurId: string
    providerDisplayName: string
    userId: string
  },
) {
  const existingLink = await admin
    .from('partner_provider_links')
    .select('partner_id, partners!inner(id, code, name, status, created_at, updated_at)')
    .eq('fournisseur_id', params.fournisseurId)
    .maybeSingle<{
      partner_id: string
      partners: {
        id: string
        code: string
        name: string
        status: 'draft' | 'sandbox_active' | 'production_active' | 'suspended'
        created_at: string
        updated_at: string
      }
    }>()

  if (existingLink.data?.partners?.id) {
    return existingLink.data.partners
  }

  if (existingLink.error && existingLink.error.code !== 'PGRST116') {
    return null
  }

  const normalizedBase = sanitizePartnerCode(params.providerDisplayName)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${randomBase62(4).toUpperCase()}`
    const code = `${normalizedBase}${suffix}`.slice(0, 40)

    const { data: partner, error: partnerError } = await admin
      .from('partners')
      .insert({
        code,
        name: params.providerDisplayName,
        status: 'sandbox_active',
      })
      .select('id, code, name, status, created_at, updated_at')
      .maybeSingle<{
        id: string
        code: string
        name: string
        status: 'draft' | 'sandbox_active' | 'production_active' | 'suspended'
        created_at: string
        updated_at: string
      }>()

    if (partnerError) {
      if (partnerError.code === '23505') {
        continue
      }
      return null
    }

    if (!partner?.id) {
      continue
    }

    const { error: linkError } = await admin
      .from('partner_provider_links')
      .insert({
        partner_id: partner.id,
        fournisseur_id: params.fournisseurId,
        role: 'owner',
        created_by_user_id: params.userId,
      })

    if (linkError) {
      return null
    }

    return partner
  }

  return null
}

function sanitizePartnerCode(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\-\s_]/g, '')
    .trim()
    .replace(/[\s\-]+/g, '_')
    .toUpperCase()

  if (!normalized) {
    return `PARTNER_${randomBase62(6).toUpperCase()}`
  }

  return normalized.slice(0, 32)
}

function generatePartnerApiKey(environment: 'sandbox' | 'production') {
  const envSegment = environment === 'production' ? 'prod' : 'sbox'
  const random = randomBase62(40)
  return `lp_${envSegment}_${random}`
}

function randomBase62(length: number) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''

  for (let index = 0; index < bytes.length; index += 1) {
    out += alphabet[bytes[index] % alphabet.length]
  }

  return out
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('')
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
