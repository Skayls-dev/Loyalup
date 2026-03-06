import { createClient } from 'npm:@supabase/supabase-js@2'

type TransferRequest = {
  external_user_id?: string
  email?: string
  transaction_ref?: string
  points?: number
  direction?: 'credit' | 'debit'
  idempotency_key?: string
  metadata?: Record<string, unknown>
  display_name?: string
  create_user_if_missing?: boolean
}

type PartnerCredentialRow = {
  id: string
  partner_id: string
  scopes: string[]
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-partner-key, idempotency-key',
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
    const idempotencyHeader = req.headers.get('Idempotency-Key')?.trim()

    if (!partnerKey || partnerKey.length < 24) {
      return json({ error: 'Missing X-Partner-Key' }, 401)
    }

    if (!idempotencyHeader) {
      return json({ error: 'Missing Idempotency-Key header' }, 400)
    }

    const body = (await req.json().catch(() => null)) as TransferRequest | null
    if (!body) {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const externalUserId = body.external_user_id?.trim()
    const email = normalizeOptionalEmail(body.email)
    const transactionRef = body.transaction_ref?.trim()
    const points = Number(body.points ?? 0)
    const direction = body.direction === 'debit' ? 'debit' : 'credit'
    const idempotencyKey = body.idempotency_key?.trim() || idempotencyHeader

    if (!externalUserId || externalUserId.length < 2) {
      return json({ error: 'external_user_id is required' }, 400)
    }

    if (!transactionRef || transactionRef.length < 4) {
      return json({ error: 'transaction_ref is required' }, 400)
    }

    if (!Number.isInteger(points) || points <= 0) {
      return json({ error: 'points must be a positive integer' }, 400)
    }

    const pointsDelta = direction === 'debit' ? -points : points

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const credential = await resolvePartnerCredential(admin, partnerKey, pepper)
    if (!credential) {
      return json({ error: 'Invalid partner key' }, 401)
    }

    if (credential.partners.status === 'suspended' || credential.partners.status === 'draft') {
      return json({ error: 'Partner is not active' }, 403)
    }

    if (credential.environment === 'production' && credential.partners.status !== 'production_active') {
      return json({ error: 'Partner production access not enabled' }, 403)
    }

    const linkedUserId = await resolveOrCreateLinkedUser(admin, {
      partnerId: credential.partner_id,
      partnerCode: credential.partners.code,
      externalUserId,
      email,
      displayName: body.display_name,
      createIfMissing: body.create_user_if_missing !== false,
    })

    if (!linkedUserId) {
      return json({ error: 'User is not linked and auto-provisioning is disabled' }, 404)
    }

    const claimedTransfer = await claimTransfer(admin, {
      partnerId: credential.partner_id,
      credentialId: credential.id,
      loyalupUserId: linkedUserId,
      externalUserId,
      transactionRef,
      idempotencyKey,
      direction,
      pointsDelta,
      metadata: body.metadata ?? {},
    })

    if (!claimedTransfer.claimed) {
      await touchCredential(admin, credential.id)
      return json(
        {
          success: true,
          status: 'duplicate',
          transfer_id: claimedTransfer.existing?.id,
          transaction_ref: transactionRef,
          partner_code: credential.partners.code,
          external_user_id: externalUserId,
          loyalup_user_id: linkedUserId,
          points_delta: claimedTransfer.existing?.points_delta,
          resulting_balance: claimedTransfer.existing?.resulting_balance,
        },
        200,
      )
    }

    const walletUpdate = await applyWalletDelta(admin, linkedUserId, pointsDelta)

    if (!walletUpdate.ok) {
      await admin
        .from('partner_point_transfers')
        .update({
          status: 'rejected',
          error_code: walletUpdate.errorCode,
          processed_at: new Date().toISOString(),
        })
        .eq('id', claimedTransfer.transferId)

      await touchCredential(admin, credential.id)
      return json({
        success: false,
        status: 'rejected',
        error: walletUpdate.errorCode,
        transaction_ref: transactionRef,
        partner_code: credential.partners.code,
      }, 409)
    }

    await admin
      .from('partner_point_transfers')
      .update({
        status: 'accepted',
        error_code: null,
        resulting_balance: walletUpdate.balance,
        processed_at: new Date().toISOString(),
      })
      .eq('id', claimedTransfer.transferId)

    await touchCredential(admin, credential.id)

    return json({
      success: true,
      status: 'accepted',
      transfer_id: claimedTransfer.transferId,
      transaction_ref: transactionRef,
      partner_code: credential.partners.code,
      external_user_id: externalUserId,
      loyalup_user_id: linkedUserId,
      points_delta: pointsDelta,
      resulting_balance: walletUpdate.balance,
    })
  } catch (error) {
    const message = extractErrorMessage(error)
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
    .select('id, partner_id, scopes, environment, expires_at, is_active, partners!inner(id, code, name, status)')
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

  return data
}

async function resolveOrCreateLinkedUser(
  admin: ReturnType<typeof createClient>,
  params: {
    partnerId: string
    partnerCode: string
    externalUserId: string
    email?: string | null
    displayName?: string
    createIfMissing: boolean
  },
): Promise<string | null> {
  const { partnerId, partnerCode, externalUserId, email, displayName, createIfMissing } = params

  const existing = await admin
    .from('partner_user_links')
    .select('loyalup_user_id')
    .eq('partner_id', partnerId)
    .eq('external_user_id', externalUserId)
    .maybeSingle<{ loyalup_user_id: string }>()

  if (existing.data?.loyalup_user_id) {
    return existing.data.loyalup_user_id
  }

  if (!createIfMissing) {
    return null
  }

  const sanitizedExternal = sanitizeEmailPart(externalUserId)
  const randomSuffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10)
  const generatedEmail = email || `${partnerCode.toLowerCase()}.${sanitizedExternal}.${randomSuffix}@partner.loyalup.local`
  const generatedPassword = `P-${crypto.randomUUID()}-A1!`

  const created = await admin.auth.admin.createUser({
    email: generatedEmail,
    password: generatedPassword,
    email_confirm: email ? false : true,
    user_metadata: {
      role: 'client',
      source_partner: partnerCode,
      external_user_id: externalUserId,
      activation_required: !email,
    },
  })

  if (created.error || !created.data.user?.id) {
    throw new Error(created.error?.message ?? 'Unable to create linked LoyalUp user')
  }

  const loyalupUserId = created.data.user.id
  const resolvedName = displayName?.trim() || externalUserId

  const profileUpsert = await admin.from('profiles').upsert({
    id: loyalupUserId,
    email: generatedEmail,
    role: 'client',
    nom: resolvedName,
  })

  if (profileUpsert.error) {
    throw new Error(profileUpsert.error.message)
  }

  const linkInsert = await admin.from('partner_user_links').insert({
    partner_id: partnerId,
    external_user_id: externalUserId,
    loyalup_user_id: loyalupUserId,
    metadata: {},
  })

  if (linkInsert.error) {
    const reloaded = await admin
      .from('partner_user_links')
      .select('loyalup_user_id')
      .eq('partner_id', partnerId)
      .eq('external_user_id', externalUserId)
      .maybeSingle<{ loyalup_user_id: string }>()

    if (reloaded.data?.loyalup_user_id) {
      return reloaded.data.loyalup_user_id
    }

    throw new Error(linkInsert.error.message)
  }

  return loyalupUserId
}

async function claimTransfer(
  admin: ReturnType<typeof createClient>,
  params: {
    partnerId: string
    credentialId: string
    loyalupUserId: string
    externalUserId: string
    transactionRef: string
    idempotencyKey: string
    direction: 'credit' | 'debit'
    pointsDelta: number
    metadata: Record<string, unknown>
  },
): Promise<{ claimed: true; transferId: string } | { claimed: false; existing: { id: string; points_delta: number; resulting_balance: number | null } | null }> {
  const insertResult = await admin
    .from('partner_point_transfers')
    .insert({
      partner_id: params.partnerId,
      credential_id: params.credentialId,
      loyalup_user_id: params.loyalupUserId,
      external_user_id: params.externalUserId,
      transaction_ref: params.transactionRef,
      idempotency_key: params.idempotencyKey,
      direction: params.direction,
      points_delta: params.pointsDelta,
      metadata: params.metadata,
      status: 'processing',
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (!insertResult.error && insertResult.data?.id) {
    return { claimed: true, transferId: insertResult.data.id }
  }

  const existing = await admin
    .from('partner_point_transfers')
    .select('id, points_delta, resulting_balance')
    .eq('partner_id', params.partnerId)
    .eq('transaction_ref', params.transactionRef)
    .maybeSingle<{ id: string; points_delta: number; resulting_balance: number | null }>()

  if (existing.data?.id) {
    return { claimed: false, existing: existing.data }
  }

  throw new Error(insertResult.error?.message ?? 'Unable to claim transfer')
}

async function applyWalletDelta(
  admin: ReturnType<typeof createClient>,
  loyalupUserId: string,
  pointsDelta: number,
): Promise<{ ok: true; balance: number } | { ok: false; errorCode: string }> {
  const wallet = await admin
    .from('partner_points_wallets')
    .select('id, balance')
    .eq('loyalup_user_id', loyalupUserId)
    .maybeSingle<{ id: string; balance: number }>()

  if (wallet.error) {
    throw new Error(wallet.error.message)
  }

  const currentBalance = Number(wallet.data?.balance ?? 0)
  const nextBalance = currentBalance + pointsDelta

  if (nextBalance < 0) {
    return { ok: false, errorCode: 'insufficient_balance' }
  }

  const upsert = await admin.from('partner_points_wallets').upsert({
    loyalup_user_id: loyalupUserId,
    balance: nextBalance,
    updated_at: new Date().toISOString(),
  })

  if (upsert.error) {
    throw new Error(upsert.error.message)
  }

  return { ok: true, balance: nextBalance }
}

async function touchCredential(admin: ReturnType<typeof createClient>, credentialId: string) {
  await admin
    .from('partner_api_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', credentialId)
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(digest))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function sanitizeEmailPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40) || 'user'
}

function normalizeOptionalEmail(value?: string): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!basicEmailPattern.test(normalized)) {
    return null
  }

  return normalized
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim().length > 0) {
      return message
    }
  }

  return 'Unexpected error'
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
