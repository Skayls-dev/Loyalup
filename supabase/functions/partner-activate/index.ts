import { createClient } from 'npm:@supabase/supabase-js@2'

type ActivateRequest = {
  external_user_id?: string
  email?: string
  display_name?: string
  redirect_to?: string
  create_user_if_missing?: boolean
}

type PartnerCredentialRow = {
  id: string
  partner_id: string
  environment: 'sandbox' | 'production'
  expires_at: string | null
  is_active: boolean
  partners: {
    id: string
    code: string
    name: string
    status: 'draft' | 'sandbox_active' | 'production_active' | 'suspended'
  }
}

type LinkRow = {
  id: string
  partner_id: string
  external_user_id: string
  loyalup_user_id: string
  metadata: Record<string, unknown> | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-partner-key',
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const pepper = Deno.env.get('PARTNER_API_KEY_PEPPER') ?? Deno.env.get('API_KEY_PEPPER')

    if (!supabaseUrl || !serviceRoleKey || !pepper) {
      return json({ error: 'Missing server configuration' }, 500)
    }

    const partnerKey = req.headers.get('X-Partner-Key')?.trim()
    if (!partnerKey || partnerKey.length < 24) {
      return json({ error: 'Missing X-Partner-Key' }, 401)
    }

    const body = (await req.json().catch(() => null)) as ActivateRequest | null
    if (!body) {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const externalUserId = body.external_user_id?.trim()
    if (!externalUserId || externalUserId.length < 2) {
      return json({ error: 'external_user_id is required' }, 400)
    }

    const normalizedEmail = normalizeEmail(body.email)
    if (!normalizedEmail) {
      return json({ error: 'A valid email is required' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const credential = await resolvePartnerCredential(admin, partnerKey, pepper)

    if (!credential) {
      return json({ error: 'Invalid partner key' }, 401)
    }

    if (credential.partners.status === 'suspended' || credential.partners.status === 'draft') {
      return json({ error: 'Partner is not active' }, 403)
    }

    const isSandbox = credential.environment === 'sandbox'

    let link = await findPartnerLink(admin, credential.partner_id, externalUserId)
    let linkedUserCreated = false

    if (!link) {
      const createIfMissing = body.create_user_if_missing !== false
      if (!createIfMissing) {
        return json({ error: 'User link not found' }, 404)
      }

      const loyalupUserId = await createLinkedUser(admin, {
        partnerId: credential.partner_id,
        partnerCode: credential.partners.code,
        externalUserId,
        email: normalizedEmail,
        displayName: body.display_name,
        autoActivate: isSandbox,
      })

      link = await findPartnerLink(admin, credential.partner_id, externalUserId)
      if (!link || link.loyalup_user_id !== loyalupUserId) {
        return json({ error: 'Unable to create partner user link' }, 500)
      }

      linkedUserCreated = true
    }

    const authUserResult = await admin.auth.admin.getUserById(link.loyalup_user_id)
    if (authUserResult.error || !authUserResult.data.user) {
      return json({ error: authUserResult.error?.message ?? 'Linked user not found' }, 404)
    }

    const authUser = authUserResult.data.user
    const authEmail = (authUser.email ?? '').trim().toLowerCase()

    if (authEmail !== normalizedEmail) {
      const updateResult = await admin.auth.admin.updateUserById(link.loyalup_user_id, {
        email: normalizedEmail,
        email_confirm: isSandbox,
        user_metadata: {
          ...(authUser.user_metadata ?? {}),
          activation_required: !isSandbox,
          email_verified: isSandbox || Boolean(authUser.user_metadata?.email_verified),
        },
      })

      if (updateResult.error) {
        return json({ error: updateResult.error.message }, 409)
      }

      const profileUpdate = await admin
        .from('profiles')
        .update({ email: normalizedEmail })
        .eq('id', link.loyalup_user_id)

      if (profileUpdate.error) {
        return json({ error: profileUpdate.error.message }, 500)
      }
    }

    const redirectTo = resolveSafeRedirectTo(body.redirect_to)

    if (isSandbox) {
      const existingMetadata = (link.metadata ?? {}) as Record<string, unknown>

      await admin
        .from('partner_user_links')
        .update({
          metadata: {
            ...existingMetadata,
            activation_email: normalizedEmail,
            activation_requested_at: new Date().toISOString(),
            activation_method: 'sandbox_auto',
            activation_source: 'partner-activate',
          },
        })
        .eq('id', link.id)

      return json({
        success: true,
        activation: {
          partner_code: credential.partners.code,
          external_user_id: externalUserId,
          loyalup_user_id: link.loyalup_user_id,
          linked_user_created: linkedUserCreated,
          email: normalizedEmail,
          activated: true,
          action_link: null,
          email_otp: null,
          hashed_token: null,
          redirect_to: redirectTo,
        },
      })
    }

    const magicLink = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo,
      },
    })

    if (magicLink.error) {
      return json({ error: magicLink.error.message }, 500)
    }

    const existingMetadata = (link.metadata ?? {}) as Record<string, unknown>

    await admin
      .from('partner_user_links')
      .update({
        metadata: {
          ...existingMetadata,
          activation_email: normalizedEmail,
          activation_requested_at: new Date().toISOString(),
          activation_method: 'magiclink',
          activation_source: 'partner-activate',
        },
      })
      .eq('id', link.id)

    return json({
      success: true,
      activation: {
        partner_code: credential.partners.code,
        external_user_id: externalUserId,
        loyalup_user_id: link.loyalup_user_id,
        linked_user_created: linkedUserCreated,
        email: normalizedEmail,
        action_link: magicLink.data.properties.action_link,
        email_otp: magicLink.data.properties.email_otp,
        hashed_token: magicLink.data.properties.hashed_token,
        redirect_to: redirectTo,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return json({ error: message }, 500)
  }
})

async function resolvePartnerCredential(
  admin: ReturnType<typeof createClient>,
  partnerKey: string,
  pepper: string,
): Promise<PartnerCredentialRow | null> {
  const keyPrefix = partnerKey.slice(0, 12)
  const keyHash = await sha256Hex(`${partnerKey}:${pepper}`)

  const { data, error } = await admin
    .from('partner_api_credentials')
    .select('id, partner_id, environment, expires_at, is_active, partners!inner(id, code, name, status)')
    .eq('key_prefix', keyPrefix)
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle<PartnerCredentialRow>()

  if (error || !data) {
    return null
  }

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return null
  }

  if (data.environment === 'production' && data.partners.status !== 'production_active') {
    return null
  }

  return data
}

async function findPartnerLink(
  admin: ReturnType<typeof createClient>,
  partnerId: string,
  externalUserId: string,
): Promise<LinkRow | null> {
  const { data, error } = await admin
    .from('partner_user_links')
    .select('id, partner_id, external_user_id, loyalup_user_id, metadata')
    .eq('partner_id', partnerId)
    .eq('external_user_id', externalUserId)
    .maybeSingle<LinkRow>()

  if (error || !data) {
    return null
  }

  return data
}

async function createLinkedUser(
  admin: ReturnType<typeof createClient>,
  params: {
    partnerId: string
    partnerCode: string
    externalUserId: string
    email: string
    displayName?: string
    autoActivate: boolean
  },
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: params.email,
    password: `P-${crypto.randomUUID()}-A1!`,
    email_confirm: params.autoActivate,
    user_metadata: {
      role: 'client',
      source_partner: params.partnerCode,
      external_user_id: params.externalUserId,
      activation_required: !params.autoActivate,
      email_verified: params.autoActivate,
    },
  })

  if (created.error || !created.data.user?.id) {
    throw created.error ?? new Error('Unable to create linked Looyaal user')
  }

  const loyalupUserId = created.data.user.id
  const resolvedName = params.displayName?.trim() || params.externalUserId

  const profileUpsert = await admin.from('profiles').upsert({
    id: loyalupUserId,
    email: params.email,
    role: 'client',
    nom: resolvedName,
  })

  if (profileUpsert.error) {
    throw profileUpsert.error
  }

  const linkInsert = await admin.from('partner_user_links').insert({
    partner_id: params.partnerId,
    external_user_id: params.externalUserId,
    loyalup_user_id: loyalupUserId,
    metadata: {
      auto_linked_by: 'partner-activate',
      linked_at: new Date().toISOString(),
    },
  })

  if (linkInsert.error) {
    const reloaded = await admin
      .from('partner_user_links')
      .select('loyalup_user_id')
      .eq('partner_id', params.partnerId)
      .eq('external_user_id', params.externalUserId)
      .maybeSingle<{ loyalup_user_id: string }>()

    if (reloaded.data?.loyalup_user_id) {
      return reloaded.data.loyalup_user_id
    }

    throw linkInsert.error
  }

  return loyalupUserId
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(digest))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function normalizeEmail(value?: string): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!basicEmailPattern.test(normalized)) {
    return null
  }

  return normalized
}

function resolveSafeRedirectTo(requestedRedirectTo?: string): string {
  const fallbackBaseUrl = 'https://looyaal.com'
  const configuredBaseUrl = (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('SITE_URL') || fallbackBaseUrl).replace(/\/$/, '')
  const safeBaseUrl = isLocalUrl(configuredBaseUrl) ? fallbackBaseUrl : configuredBaseUrl

  const requested = requestedRedirectTo?.trim()
  if (requested && requested.startsWith('http') && !isLocalUrl(requested)) {
    return requested
  }

  return `${safeBaseUrl}/auth/callback`
}

function isLocalUrl(value: string): boolean {
  const lower = value.toLowerCase()
  return lower.includes('localhost') || lower.includes('127.0.0.1')
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
