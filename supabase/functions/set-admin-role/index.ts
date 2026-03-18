import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = {
  userId?: string
  role?: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
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

  const { data: callerData, error: callerError } = await authClient.auth.getUser(token)
  if (callerError || !callerData.user?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const callerId = callerData.user.id
  const callerRole = String(callerData.user.app_metadata?.role ?? '')

  let isSuperAdmin = callerRole === 'super_admin'

  if (!isSuperAdmin) {
    const { data: callerAdminUser, error: callerAdminError } = await admin.auth.admin.getUserById(callerId)
    if (callerAdminError || !callerAdminUser.user) {
      return json({ error: 'Forbidden' }, 403)
    }
    isSuperAdmin = String(callerAdminUser.user.app_metadata?.role ?? '') === 'super_admin'
  }

  if (!isSuperAdmin) {
    return json({ error: 'Forbidden' }, 403)
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const userId = String(body.userId ?? '').trim()
  const role = String(body.role ?? '').trim()

  if (!userId || !role) {
    return json({ error: 'Missing userId or role' }, 400)
  }

  if (!['admin', 'super_admin'].includes(role)) {
    return json({ error: 'Invalid role' }, 400)
  }

  const { data: targetUser, error: targetUserError } = await admin.auth.admin.getUserById(userId)
  if (targetUserError || !targetUser.user) {
    return json({ error: 'Target user not found' }, 404)
  }

  const nextMetadata = {
    ...(targetUser.user.app_metadata ?? {}),
    role,
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: nextMetadata,
  })

  if (updateError) {
    return json({ error: updateError.message }, 500)
  }

  return json({ success: true })
})
