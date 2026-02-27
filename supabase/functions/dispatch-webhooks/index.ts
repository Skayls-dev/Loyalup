import { createClient } from 'npm:@supabase/supabase-js@2'

type DispatchRequest = {
  fournisseur_id: string
  event_type: string
  payload: Record<string, unknown>
}

type WebhookRow = {
  id: string
  fournisseur_id: string
  url: string
  secret: string
  events: string[]
  is_active: boolean
  failure_count: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ATTEMPTS = 3
const FAILURE_DISABLE_THRESHOLD = 10

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const internalToken = Deno.env.get('WEBHOOK_DISPATCH_TOKEN')

  if (!supabaseUrl || !serviceRoleKey || !internalToken) {
    return json({ error: 'Missing env vars' }, 500)
  }

  const bearer = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
  if (bearer !== internalToken) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: DispatchRequest
  try {
    body = (await req.json()) as DispatchRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body?.fournisseur_id || !body?.event_type || !body?.payload) {
    return json({ error: 'Missing fournisseur_id, event_type or payload' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: webhooks, error: hooksError } = await admin
    .from('webhooks')
    .select('id, fournisseur_id, url, secret, events, is_active, failure_count')
    .eq('fournisseur_id', body.fournisseur_id)
    .eq('is_active', true)

  if (hooksError) {
    return json({ error: hooksError.message }, 500)
  }

  const targets = (webhooks ?? []).filter((webhook) => {
    const events = webhook.events ?? []
    return events.includes('*') || events.includes(body.event_type)
  }) as WebhookRow[]

  const eventEnvelope = {
    id: crypto.randomUUID(),
    type: body.event_type,
    fournisseur_id: body.fournisseur_id,
    created_at: new Date().toISOString(),
    data: body.payload,
  }

  const deliveries = await Promise.all(targets.map((webhook) => deliverWebhook(admin, webhook, eventEnvelope)))

  return json({
    success: true,
    event_id: eventEnvelope.id,
    sent: deliveries.length,
    deliveries,
  })
})

async function deliverWebhook(
  admin: ReturnType<typeof createClient>,
  webhook: WebhookRow,
  payload: Record<string, unknown>,
) {
  const body = JSON.stringify(payload)
  let lastStatus: number | null = null
  let lastResponseBody = ''
  let succeeded = false
  let lastDuration = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = performance.now()

    try {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const signature = await signPayload(webhook.secret, `${timestamp}.${body}`)
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LoyalUp-Webhook-Dispatcher/1.0',
          'X-Loyalup-Event': String(payload.type ?? ''),
          'X-Loyalup-Webhook-Id': webhook.id,
          'X-Loyalup-Timestamp': timestamp,
          'X-Loyalup-Signature': `v1=${signature}`,
        },
        body,
      })

      lastDuration = Math.round(performance.now() - startedAt)
      lastStatus = response.status
      lastResponseBody = await response.text()
      succeeded = response.ok
    } catch (error) {
      lastDuration = Math.round(performance.now() - startedAt)
      lastStatus = null
      lastResponseBody = error instanceof Error ? error.message : 'fetch_failed'
      succeeded = false
    }

    await admin.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event_type: String(payload.type ?? ''),
      payload,
      response_status: lastStatus,
      response_body: lastResponseBody.slice(0, 4000),
      duration_ms: lastDuration,
      attempt_number: attempt,
      success: succeeded,
    })

    if (succeeded) {
      await admin
        .from('webhooks')
        .update({
          failure_count: 0,
          last_triggered_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
        })
        .eq('id', webhook.id)

      return {
        webhook_id: webhook.id,
        success: true,
        attempts: attempt,
        status_code: lastStatus,
      }
    }

    if (attempt < MAX_ATTEMPTS) {
      await waitWithBackoff(attempt)
    }
  }

  const nextFailures = Number(webhook.failure_count ?? 0) + 1
  await admin
    .from('webhooks')
    .update({
      failure_count: nextFailures,
      last_triggered_at: new Date().toISOString(),
      is_active: nextFailures < FAILURE_DISABLE_THRESHOLD,
    })
    .eq('id', webhook.id)

  return {
    webhook_id: webhook.id,
    success: false,
    attempts: MAX_ATTEMPTS,
    status_code: lastStatus,
    disabled: nextFailures >= FAILURE_DISABLE_THRESHOLD,
  }
}

async function signPayload(secret: string, message: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function waitWithBackoff(attempt: number) {
  const delay = attempt === 1 ? 500 : 1500
  await new Promise((resolve) => setTimeout(resolve, delay))
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
