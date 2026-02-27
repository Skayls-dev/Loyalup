import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SEGMENT_PRIORITY = ['champion', 'loyal', 'potential', 'at_risk', 'lost', 'new', 'occasional']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.replace('Bearer ', '').trim()

  const authClient = createClient(supabaseUrl, anonKey)
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt)

  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: segments, error: segmentError } = await adminClient
    .from('user_segments')
    .select('segment_type, segment_data, score, computed_at')
    .eq('client_id', userData.user.id)
    .order('computed_at', { ascending: false })

  if (segmentError) {
    return new Response(JSON.stringify({ error: segmentError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const rows = Array.isArray(segments) ? segments : []

  const prioritized = SEGMENT_PRIORITY
    .map((type) => rows.find((row) => row.segment_type === type))
    .find((row) => row)

  const fallback = rows[0]
  const resolved = prioritized ?? fallback ?? null

  return new Response(
    JSON.stringify({
      segment_type: resolved?.segment_type ?? 'new',
      segment_data: resolved?.segment_data ?? {},
      score: typeof resolved?.score === 'number' ? resolved.score : null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
