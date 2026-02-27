import { createClient } from 'npm:@supabase/supabase-js@2'

type WhiteLabelRequest =
  | { action: 'GET' }
  | {
      action: 'UPSERT'
      payload: {
        brand_name: string
        logo_url?: string | null
        favicon_url?: string | null
        primary_color?: string | null
        secondary_color?: string | null
        accent_color?: string | null
        font_family?: string | null
        custom_domain?: string | null
        hide_loyalup_branding?: boolean
        custom_terms_url?: string | null
        custom_privacy_url?: string | null
        from_email?: string | null
        from_name?: string | null
        email_header_color?: string | null
      }
    }
  | { action: 'VERIFY_DOMAIN'; custom_domain: string; verification_token: string }

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

  let body: WhiteLabelRequest
  try {
    body = (await req.json()) as WhiteLabelRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { data: fournisseur, error: fournisseurError } = await admin
    .from('fournisseurs')
    .select('id')
    .eq('user_id', userResult.user.id)
    .maybeSingle<{ id: string }>()

  if (fournisseurError || !fournisseur?.id) {
    return json({ error: 'Provider not found' }, 404)
  }

  if (body.action === 'GET') {
    const { data, error } = await admin
      .from('white_label_configs')
      .select('*')
      .eq('fournisseur_id', fournisseur.id)
      .maybeSingle()

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, config: data ?? null })
  }

  if (body.action === 'UPSERT') {
    const payload = body.payload
    if (!payload?.brand_name || payload.brand_name.trim().length < 2) {
      return json({ error: 'Invalid brand_name' }, 400)
    }

    if (payload.primary_color && !isHexColor(payload.primary_color)) {
      return json({ error: 'Invalid primary_color' }, 400)
    }

    if (payload.secondary_color && !isHexColor(payload.secondary_color)) {
      return json({ error: 'Invalid secondary_color' }, 400)
    }

    if (payload.accent_color && !isHexColor(payload.accent_color)) {
      return json({ error: 'Invalid accent_color' }, 400)
    }

    const domain = normalizeNullable(payload.custom_domain)
    const tokenValue = crypto.randomUUID().replace(/-/g, '')

    const { data: existing } = await admin
      .from('white_label_configs')
      .select('id, custom_domain')
      .eq('fournisseur_id', fournisseur.id)
      .maybeSingle<{ id: string; custom_domain: string | null }>()

    const domainChanged = Boolean(domain) && domain !== (existing?.custom_domain ?? null)

    const { data, error } = await admin
      .from('white_label_configs')
      .upsert(
        {
          fournisseur_id: fournisseur.id,
          brand_name: payload.brand_name.trim(),
          logo_url: normalizeNullable(payload.logo_url),
          favicon_url: normalizeNullable(payload.favicon_url),
          primary_color: normalizeNullable(payload.primary_color),
          secondary_color: normalizeNullable(payload.secondary_color),
          accent_color: normalizeNullable(payload.accent_color),
          font_family: normalizeNullable(payload.font_family) ?? 'DM Sans',
          custom_domain: domain,
          domain_verified: domainChanged ? false : undefined,
          domain_verified_at: domainChanged ? null : undefined,
          verification_token: domainChanged ? tokenValue : undefined,
          hide_loyalup_branding: Boolean(payload.hide_loyalup_branding),
          custom_terms_url: normalizeNullable(payload.custom_terms_url),
          custom_privacy_url: normalizeNullable(payload.custom_privacy_url),
          from_email: normalizeNullable(payload.from_email),
          from_name: normalizeNullable(payload.from_name),
          email_header_color: normalizeNullable(payload.email_header_color),
        },
        { onConflict: 'fournisseur_id' },
      )
      .select('*')
      .single()

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, config: data })
  }

  if (body.action === 'VERIFY_DOMAIN') {
    const { data: config, error } = await admin
      .from('white_label_configs')
      .select('id, custom_domain, verification_token')
      .eq('fournisseur_id', fournisseur.id)
      .maybeSingle<{ id: string; custom_domain: string | null; verification_token: string | null }>()

    if (error) {
      return json({ error: error.message }, 500)
    }

    if (!config?.id || !config.custom_domain) {
      return json({ error: 'No domain configured' }, 404)
    }

    const domainMatches = config.custom_domain === body.custom_domain.trim().toLowerCase()
    const tokenMatches = config.verification_token === body.verification_token

    if (!domainMatches || !tokenMatches) {
      return json({ success: false, verified: false }, 400)
    }

    const { error: updateError } = await admin
      .from('white_label_configs')
      .update({
        domain_verified: true,
        domain_verified_at: new Date().toISOString(),
      })
      .eq('id', config.id)

    if (updateError) {
      return json({ error: updateError.message }, 500)
    }

    return json({ success: true, verified: true })
  }

  return json({ error: 'Unsupported action' }, 400)
})

function normalizeNullable(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
