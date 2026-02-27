import { createClient } from 'npm:@supabase/supabase-js@2'

type Action = 'CREATE_ANNOUNCEMENT' | 'UPDATE_ANNOUNCEMENT' | 'DELETE_ANNOUNCEMENT' | 'GET_ANNOUNCEMENTS'

type Body = {
  action?: Action
  network_id?: string
  announcement_id?: string
  payload?: Record<string, unknown>
}

type UserRole = 'client' | 'fournisseur' | 'admin'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function getContext(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: json({ error: 'Missing env vars' }, 500), admin: null, userId: null, role: null }
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null, userId: null, role: null }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: userResult, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userResult.user?.id) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null, userId: null, role: null }
  }

  const userId = userResult.user.id

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<{ role: UserRole }>()

  if (profileError || !profile?.role) {
    return { error: json({ error: 'Forbidden' }, 403), admin: null, userId: null, role: null }
  }

  return { error: null, admin, userId, role: profile.role }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const context = await getContext(req)
  if (context.error || !context.admin || !context.userId || !context.role) {
    return context.error ?? json({ error: 'Unauthorized' }, 401)
  }

  const { admin, userId, role } = context

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const action = body.action
  if (!action) {
    return json({ error: 'Missing action' }, 400)
  }

  if (action === 'CREATE_ANNOUNCEMENT') {
    if (role !== 'admin') {
      return json({ error: 'Admin only' }, 403)
    }

    const networkId = String(body.network_id ?? body.payload?.network_id ?? '')
    if (!networkId) {
      return json({ error: 'network_id is required' }, 400)
    }

    const payload = {
      ...(body.payload ?? {}),
      network_id: networkId,
      created_by: userId,
    }

    const { data: inserted, error: insertError } = await admin
      .from('network_announcements')
      .insert(payload)
      .select('*')
      .single()

    if (insertError) {
      return json({ error: insertError.message }, 500)
    }

    const { data: network } = await admin
      .from('networks')
      .select('name')
      .eq('id', networkId)
      .maybeSingle<{ name: Record<string, string> | null }>()

    const networkName = network?.name?.fr ?? network?.name?.en ?? 'Réseau'
    const titleObj = (inserted as Record<string, unknown>).title as Record<string, string> | null
    const emoji = String((inserted as Record<string, unknown>).emoji ?? '📢')
    const shortTitle = titleObj?.fr ?? titleObj?.en ?? 'Nouvelle annonce'

    const { data: enrolledClients } = await admin
      .from('network_clients')
      .select('client_id')
      .eq('network_id', networkId)

    const notificationRows = (enrolledClients ?? []).map((row) => ({
      user_id: row.client_id,
      type: 'network_announcement',
      title: `${emoji} ${networkName}`,
      body: shortTitle,
      data: {
        network_id: networkId,
        announcement_id: (inserted as Record<string, unknown>).id,
      },
    }))

    if (notificationRows.length > 0) {
      await admin.from('notifications').insert(notificationRows)
    }

    return json({ announcement: inserted })
  }

  if (action === 'UPDATE_ANNOUNCEMENT') {
    if (role !== 'admin') {
      return json({ error: 'Admin only' }, 403)
    }

    const announcementId = String(body.announcement_id ?? body.payload?.id ?? '')
    if (!announcementId) {
      return json({ error: 'announcement_id is required' }, 400)
    }

    const { data: updated, error: updateError } = await admin
      .from('network_announcements')
      .update(body.payload ?? {})
      .eq('id', announcementId)
      .select('*')
      .single()

    if (updateError) {
      return json({ error: updateError.message }, 500)
    }

    return json({ announcement: updated })
  }

  if (action === 'DELETE_ANNOUNCEMENT') {
    if (role !== 'admin') {
      return json({ error: 'Admin only' }, 403)
    }

    const announcementId = String(body.announcement_id ?? '')
    if (!announcementId) {
      return json({ error: 'announcement_id is required' }, 400)
    }

    const { error: deleteError } = await admin
      .from('network_announcements')
      .update({ expires_at: new Date().toISOString() })
      .eq('id', announcementId)

    if (deleteError) {
      return json({ error: deleteError.message }, 500)
    }

    return json({ success: true })
  }

  if (action === 'GET_ANNOUNCEMENTS') {
    let allowedNetworkIds: string[] = []

    if (role === 'admin') {
      const requestedNetworkId = body.network_id ? String(body.network_id) : null
      if (requestedNetworkId) {
        allowedNetworkIds = [requestedNetworkId]
      } else {
        const { data: allNetworks } = await admin.from('networks').select('id').eq('is_active', true)
        allowedNetworkIds = (allNetworks ?? []).map((row) => row.id as string)
      }
    } else if (role === 'client') {
      const { data: memberships } = await admin
        .from('network_clients')
        .select('network_id')
        .eq('client_id', userId)

      allowedNetworkIds = (memberships ?? []).map((row) => row.network_id as string)
    } else {
      const { data: provider } = await admin
        .from('fournisseurs')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle<{ id: string }>()

      if (!provider?.id) {
        return json({ announcements: [] })
      }

      const { data: memberships } = await admin
        .from('network_members')
        .select('network_id')
        .eq('fournisseur_id', provider.id)
        .eq('status', 'active')

      allowedNetworkIds = (memberships ?? []).map((row) => row.network_id as string)
    }

    if (allowedNetworkIds.length === 0) {
      return json({ announcements: [] })
    }

    const nowIso = new Date().toISOString()

    const { data: announcements, error: announcementsError } = await admin
      .from('network_announcements')
      .select('*')
      .in('network_id', allowedNetworkIds)
      .lte('published_at', nowIso)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })

    if (announcementsError) {
      return json({ error: announcementsError.message }, 500)
    }

    return json({ announcements: announcements ?? [] })
  }

  return json({ error: `Unsupported action: ${action}` }, 400)
})
