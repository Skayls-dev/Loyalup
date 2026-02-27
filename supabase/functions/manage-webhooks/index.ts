import { createClient } from 'npm:@supabase/supabase-js@2'

type WebhookRequest =
  | { action: 'LIST' }
  | { action: 'CREATE'; url: string; events: string[] }
  | { action: 'UPDATE'; webhook_id: string; url?: string; events?: string[]; is_active?: boolean }
  | { action: 'DELETE'; webhook_id: string }
  | { action: 'ROTATE_SECRET'; webhook_id: string }

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

  let body: WebhookRequest
  try {
    body = (await req.json()) as WebhookRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body?.action) {
    return json({ error: 'Missing action' }, 400)
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: userResult, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userResult.user?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const providerUserId = userResult.user.id

  const { data: fournisseur, error: fournisseurError } = await admin
    .from('fournisseurs')
    .select('id, tier')
    .eq('user_id', providerUserId)
    .maybeSingle<{ id: string; tier: string }>()

  if (fournisseurError || !fournisseur?.id) {
    return json({ error: 'Provider not found' }, 404)
  }

  if (body.action === 'LIST') {
    const { data, error } = await admin
      .from('webhooks')
      .select('id, url, events, is_active, failure_count, last_triggered_at, last_success_at, created_at')
      .eq('fournisseur_id', fournisseur.id)
      .order('created_at', { ascending: false })

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, webhooks: data ?? [] })
  }

  if (body.action === 'CREATE') {
    const events = sanitizeEvents(body.events)
    if (!isValidUrl(body.url) || events.length === 0) {
      return json({ error: 'Invalid url or events' }, 400)
    }

    const tierLimit = await getWebhookLimit(admin, fournisseur.tier)
    const { count } = await admin
      .from('webhooks')
      .select('id', { head: true, count: 'exact' })
      .eq('fournisseur_id', fournisseur.id)
      .eq('is_active', true)

    if ((count ?? 0) >= tierLimit) {
      return json({ error: `Tier limit reached: max ${tierLimit} active webhooks` }, 403)
    }

    const { data, error } = await admin
      .from('webhooks')
      .insert({
        fournisseur_id: fournisseur.id,
        url: body.url.trim(),
        events,
        secret: generateWebhookSecret(),
        is_active: true,
      })
      .select('id, url, events, is_active, failure_count, created_at')
      .single()

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, webhook: data })
  }

  if (body.action === 'UPDATE') {
    const updates: Record<string, unknown> = {}

    if (body.url !== undefined) {
      if (!isValidUrl(body.url)) {
        return json({ error: 'Invalid url' }, 400)
      }
      updates.url = body.url.trim()
    }

    if (body.events !== undefined) {
      const events = sanitizeEvents(body.events)
      if (events.length === 0) {
        return json({ error: 'Invalid events' }, 400)
      }
      updates.events = events
    }

    if (body.is_active !== undefined) {
      updates.is_active = body.is_active
    }

    const { data, error } = await admin
      .from('webhooks')
      .update(updates)
      .eq('id', body.webhook_id)
      .eq('fournisseur_id', fournisseur.id)
      .select('id, url, events, is_active, failure_count, last_triggered_at, last_success_at, created_at')
      .single()

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, webhook: data })
  }

  if (body.action === 'DELETE') {
    const { error } = await admin
      .from('webhooks')
      .delete()
      .eq('id', body.webhook_id)
      .eq('fournisseur_id', fournisseur.id)

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, deleted: true })
  }

  if (body.action === 'ROTATE_SECRET') {
    const nextSecret = generateWebhookSecret()

    const { error } = await admin
      .from('webhooks')
      .update({ secret: nextSecret })
      .eq('id', body.webhook_id)
      .eq('fournisseur_id', fournisseur.id)

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, webhook_id: body.webhook_id, secret: nextSecret, secret_once: true })
  }

  return json({ error: 'Unsupported action' }, 400)
})

async function getWebhookLimit(admin: ReturnType<typeof createClient>, tier: string) {
  const { data, error } = await admin
    .from('rate_limit_rules')
    .select('max_webhooks')
    .eq('tier', tier)
    .maybeSingle<{ max_webhooks: number }>()

  if (error || !data) {
    throw new Error('Failed to load tier rule')
  }

  return data.max_webhooks
}

function sanitizeEvents(events: string[]) {
  const allowed = new Set([
    '*',
    'client.created',
    'client.updated',
    'service.created',
    'service.updated',
    'transaction.created',
    'transaction.validated',
    'promotion.created',
    'promotion.updated',
  ])

  const unique = Array.from(new Set(events.map((event) => event.trim()).filter(Boolean)))
  return unique.filter((event) => allowed.has(event))
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function generateWebhookSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `whsec_${hex}`
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
