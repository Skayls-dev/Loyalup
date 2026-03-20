import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolvePartnerIdentity } from '../_shared/partnerIdentityResolver.ts'
import type { PartnerIdentityResolveRequest } from '../_shared/partnerIdentity.ts'

type ResolveRequest = PartnerIdentityResolveRequest & {
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

    const body = (await req.json().catch(() => null)) as ResolveRequest | null
    if (!body) {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const externalUserId = body.external_user_id?.trim()
    if (!externalUserId || externalUserId.length < 2) {
      return json({ error: 'external_user_id is required' }, 400)
    }

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

    const resolved = await resolvePartnerIdentity({
      admin,
      partnerId: credential.partner_id,
      partnerCode: credential.partners.code,
      externalUserId,
      email: body.email,
      displayName: body.display_name,
      source: body.source ?? 'partner-api',
      createIfMissing: body.create_user_if_missing === true || credential.environment === 'sandbox',
      autoActivate: credential.environment === 'sandbox',
    })

    return json({ success: true, identity: resolved })
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

  return data
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(digest))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
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
