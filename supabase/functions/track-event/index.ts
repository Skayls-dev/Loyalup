import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type TrackEventBody = {
  event_type?: string
  properties?: Record<string, unknown>
  session_id?: string
  page?: string
  app_version?: string
}

function detectDeviceType(userAgent: string | null): 'mobile' | 'tablet' | 'desktop' {
  const ua = (userAgent ?? '').toLowerCase()

  if (/ipad|tablet|kindle|playbook/.test(ua)) {
    return 'tablet'
  }

  if (/mobi|android|iphone|ipod|phone/.test(ua)) {
    return 'mobile'
  }

  return 'desktop'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const receivedResponse = new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return receivedResponse
    }

    const body = (await req.json().catch(() => ({}))) as TrackEventBody
    const eventType = body.event_type?.trim()
    const sessionId = body.session_id?.trim()

    if (!eventType || !sessionId) {
      return receivedResponse
    }

    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')

    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '').trim()
      if (jwt.length > 0) {
        const authClient = createClient(supabaseUrl, anonKey)
        const { data } = await authClient.auth.getUser(jwt)
        userId = data.user?.id ?? null
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    if (userId) {
      const { data: consentRows } = await adminClient
        .from('user_consents')
        .select('granted, revoked_at')
        .eq('user_id', userId)
        .eq('consent_type', 'analytics')
        .order('granted_at', { ascending: false })
        .limit(1)

      const latestConsent = consentRows?.[0]
      const analyticsAllowed = Boolean(latestConsent?.granted) && !latestConsent?.revoked_at
      if (!analyticsAllowed) {
        return receivedResponse
      }
    }

    await adminClient.from('user_events').insert({
      user_id: userId,
      session_id: sessionId,
      event_type: eventType,
      properties: body.properties ?? {},
      page: body.page ?? null,
      app_version: body.app_version ?? null,
      device_type: detectDeviceType(req.headers.get('user-agent')),
    })

    return receivedResponse
  } catch {
    return receivedResponse
  }
})
