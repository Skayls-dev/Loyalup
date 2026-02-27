import { createClient } from 'npm:@supabase/supabase-js@2'

type AdminAction =
  | 'GET_OVERVIEW'
  | 'LIST_USERS'
  | 'UPDATE_USER_ROLE'
  | 'UPDATE_PROVIDER_TIER'
  | 'TOGGLE_USER_BLOCK'
  | 'BULK_UPDATE_USERS'
  | 'BULK_IMPORT_USERS'
  | 'IMPERSONATE_USER'
  | 'GET_API_USAGE'
  | 'GET_WEBHOOK_FAILURES'
  | 'RETRY_WEBHOOK_DELIVERY'
  | 'GET_AUDIT_LOGS'

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

  const adminUserId = userResult.user.id

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', adminUserId)
    .maybeSingle<{ role: string }>()

  if (profileError || profile?.role !== 'admin') {
    return json({ error: 'Forbidden' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const action = String(body.action ?? '') as AdminAction

  if (action === 'GET_OVERVIEW') {
    const [
      providersCount,
      clientsCount,
      adminsCount,
      usersCount,
      txCount,
      apiErrors,
      failedDeliveries,
    ] = await Promise.all([
      admin.from('fournisseurs').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('transactions').select('id', { count: 'exact', head: true }),
      admin.from('api_usage').select('id', { count: 'exact', head: true }).gte('status_code', 400),
      admin.from('webhook_deliveries').select('id', { count: 'exact', head: true }).eq('success', false),
    ])

    return json({
      success: true,
      overview: {
        providers: providersCount.count ?? 0,
        clients: clientsCount.count ?? 0,
        admins: adminsCount.count ?? 0,
        total_users: usersCount.count ?? 0,
        transactions: txCount.count ?? 0,
        api_errors: apiErrors.count ?? 0,
        failed_webhook_deliveries: failedDeliveries.count ?? 0,
      },
    })
  }

  if (action === 'LIST_USERS') {
    const page = Math.max(1, Number(body.page ?? 1))
    const limit = Math.min(100, Math.max(1, Number(body.limit ?? 25)))
    const from = (page - 1) * limit
    const to = from + limit - 1
    const search = String(body.search ?? '').trim().toLowerCase()

    const listed = await admin.auth.admin.listUsers({ page, perPage: limit })
    if (listed.error) {
      return json({ error: listed.error.message }, 500)
    }

    const authUsers = (listed.data.users ?? []) as Array<{
      id: string
      email?: string | null
      created_at?: string
      last_sign_in_at?: string | null
      banned_until?: string | null
      user_metadata?: Record<string, unknown>
      app_metadata?: Record<string, unknown>
    }>

    const ids = authUsers.map((user: { id: string }) => user.id)

    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('id, role, nom, email').in('id', ids)
      : { data: [] as Array<{ id: string; role: string; nom: string; email: string }> }

    const typedProfiles = (profiles ?? []) as Array<{ id: string; role: string; nom: string; email: string }>
    const profileMap = new Map(typedProfiles.map((row) => [row.id, row]))

    const { data: providersData } = ids.length
      ? await admin.from('fournisseurs').select('user_id, tier').in('user_id', ids)
      : { data: [] as Array<{ user_id: string; tier: string | null }> }

    const providerTierMap = new Map(
      ((providersData ?? []) as Array<{ user_id: string; tier: string | null }>).map((row) => [
        row.user_id,
        row.tier,
      ]),
    )

    const rows = authUsers
      .map((user) => {
        const profileRow = profileMap.get(user.id)
        const email = user.email ?? profileRow?.email ?? ''
        const role = (profileRow?.role ?? user.user_metadata?.role ?? user.app_metadata?.role ?? 'client') as string
        const blocked = Boolean(user.banned_until && user.banned_until !== 'none')

        return {
          id: user.id,
          email,
          role,
          nom: String(profileRow?.nom ?? user.user_metadata?.nom ?? ''),
          provider_tier: providerTierMap.get(user.id) ?? null,
          blocked,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
        }
      })
      .filter((row) => {
        if (!search) {
          return true
        }

        return (
          row.email.toLowerCase().includes(search) ||
          row.nom.toLowerCase().includes(search) ||
          row.role.toLowerCase().includes(search)
        )
      })

    return json({
      success: true,
      users: rows,
      pagination: {
        page,
        limit,
        from,
        to,
      },
    })
  }

  if (action === 'UPDATE_USER_ROLE') {
    const userId = String(body.user_id ?? '')
    const role = String(body.role ?? '')

    if (!userId || !['client', 'fournisseur', 'admin'].includes(role)) {
      return json({ error: 'Invalid user_id or role' }, 400)
    }

    const roleUpdateError = await applyRoleUpdate(admin, userId, role as 'client' | 'fournisseur' | 'admin')
    if (roleUpdateError) {
      await writeAuditLog(admin, {
        adminUserId,
        action: 'UPDATE_USER_ROLE',
        targetUserId: userId,
        success: false,
        metadata: { role, error: roleUpdateError },
      })
      return json({ error: roleUpdateError }, 500)
    }

    await writeAuditLog(admin, {
      adminUserId,
      action: 'UPDATE_USER_ROLE',
      targetUserId: userId,
      success: true,
      metadata: { role },
    })

    return json({ success: true, user_id: userId, role })
  }

  if (action === 'UPDATE_PROVIDER_TIER') {
    const userId = String(body.user_id ?? '')
    const tier = String(body.tier ?? '')

    if (!userId || !['free', 'starter', 'premium', 'enterprise'].includes(tier)) {
      return json({ error: 'Invalid user_id or tier' }, 400)
    }

    const { data: provider, error } = await admin
      .from('fournisseurs')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>()

    if (error || !provider?.id) {
      return json({ error: error?.message ?? 'Provider not found for this user' }, 404)
    }

    const { error: updateError } = await admin
      .from('fournisseurs')
      .update({ tier })
      .eq('user_id', userId)

    if (updateError) {
      await writeAuditLog(admin, {
        adminUserId,
        action: 'UPDATE_PROVIDER_TIER',
        targetUserId: userId,
        success: false,
        metadata: { tier, error: updateError.message },
      })
      return json({ error: updateError.message }, 500)
    }

    await writeAuditLog(admin, {
      adminUserId,
      action: 'UPDATE_PROVIDER_TIER',
      targetUserId: userId,
      success: true,
      metadata: { tier },
    })

    return json({ success: true, user_id: userId, tier })
  }

  if (action === 'TOGGLE_USER_BLOCK') {
    const userId = String(body.user_id ?? '')
    const blocked = Boolean(body.blocked)

    if (!userId) {
      return json({ error: 'Missing user_id' }, 400)
    }

    const blockError = await applyBlockedUpdate(admin, userId, blocked)
    if (blockError) {
      await writeAuditLog(admin, {
        adminUserId,
        action: 'TOGGLE_USER_BLOCK',
        targetUserId: userId,
        success: false,
        metadata: { blocked, error: blockError },
      })
      return json({ error: blockError }, 500)
    }

    await writeAuditLog(admin, {
      adminUserId,
      action: 'TOGGLE_USER_BLOCK',
      targetUserId: userId,
      success: true,
      metadata: { blocked },
    })

    return json({ success: true, user_id: userId, blocked })
  }

  if (action === 'BULK_UPDATE_USERS') {
    const userIds = Array.isArray(body.user_ids)
      ? body.user_ids.map((value) => String(value)).filter(Boolean)
      : []

    const role = body.role ? String(body.role) : null
    const blocked = typeof body.blocked === 'boolean' ? Boolean(body.blocked) : null

    if (userIds.length === 0) {
      return json({ error: 'user_ids is required' }, 400)
    }

    if (role === null && blocked === null) {
      return json({ error: 'At least one operation is required (role and/or blocked)' }, 400)
    }

    if (role !== null && !['client', 'fournisseur', 'admin'].includes(role)) {
      return json({ error: 'Invalid role' }, 400)
    }

    const results: Array<{ user_id: string; ok: boolean; error?: string }> = []

    for (const userId of userIds) {
      let errorMessage: string | null = null

      if (role !== null) {
        errorMessage = await applyRoleUpdate(admin, userId, role as 'client' | 'fournisseur' | 'admin')
      }

      if (!errorMessage && blocked !== null) {
        errorMessage = await applyBlockedUpdate(admin, userId, blocked)
      }

      results.push(
        errorMessage
          ? { user_id: userId, ok: false, error: errorMessage }
          : { user_id: userId, ok: true },
      )
    }

    const succeeded = results.filter((row) => row.ok).length
    const failed = results.length - succeeded

    await writeAuditLog(admin, {
      adminUserId,
      action: 'BULK_UPDATE_USERS',
      success: failed === 0,
      metadata: {
        total: results.length,
        succeeded,
        failed,
        role,
        blocked,
      },
    })

    return json({
      success: true,
      summary: { total: results.length, succeeded, failed },
      results,
    })
  }

  if (action === 'BULK_IMPORT_USERS') {
    const rows = Array.isArray(body.rows)
      ? (body.rows as Array<Record<string, unknown>>)
      : []

    if (rows.length === 0) {
      return json({ error: 'rows is required' }, 400)
    }

    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listed.error) {
      return json({ error: listed.error.message }, 500)
    }

    const authUsers = (listed.data.users ?? []) as Array<{ id: string; email?: string | null }>
    const emailMap = new Map<string, string>(
      authUsers
        .filter((user: { id: string; email?: string | null }) => Boolean(user.email))
        .map((user: { id: string; email?: string | null }) => [String(user.email).toLowerCase(), user.id]),
    )

    const results: Array<{ row: number; user_id: string | null; ok: boolean; error?: string }> = []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] as {
        role?: unknown
        tier?: unknown
        blocked?: unknown
        user_id?: unknown
        email?: unknown
      }
      const role = typeof row.role === 'string' ? row.role : null
      const tier = typeof row.tier === 'string' ? row.tier : null
      const blocked =
        row.blocked === undefined || row.blocked === null
          ? null
          : Boolean(row.blocked)

      const userIdRaw = typeof row.user_id === 'string' ? row.user_id : null
      const emailRaw = typeof row.email === 'string' ? row.email.toLowerCase() : null
      const resolvedUserId: string | null = userIdRaw ?? (emailRaw ? emailMap.get(emailRaw) ?? null : null)

      if (!resolvedUserId) {
        results.push({ row: index + 1, user_id: null, ok: false, error: 'Unable to resolve user_id/email' })
        continue
      }
      const resolvedUserIdString: string = resolvedUserId

      let errorMessage: string | null = null

      if (role !== null) {
        if (!['client', 'fournisseur', 'admin'].includes(role)) {
          errorMessage = 'Invalid role'
        } else {
          errorMessage = await applyRoleUpdate(admin, resolvedUserIdString, role as 'client' | 'fournisseur' | 'admin')
        }
      }

      if (!errorMessage && blocked !== null) {
        errorMessage = await applyBlockedUpdate(admin, resolvedUserIdString, blocked)
      }

      if (!errorMessage && tier !== null) {
        if (!['free', 'starter', 'premium', 'enterprise'].includes(tier)) {
          errorMessage = 'Invalid tier'
        } else {
          const { data: provider, error: providerError } = await admin
            .from('fournisseurs')
            .select('id')
            .eq('user_id', resolvedUserIdString)
            .maybeSingle<{ id: string }>()

          if (providerError || !provider?.id) {
            errorMessage = providerError?.message ?? 'Provider not found for tier update'
          } else {
            const { error: tierError } = await admin
              .from('fournisseurs')
              .update({ tier })
              .eq('user_id', resolvedUserIdString)

            if (tierError) {
              errorMessage = tierError.message
            }
          }
        }
      }

      results.push(
        errorMessage
          ? { row: index + 1, user_id: resolvedUserIdString, ok: false, error: errorMessage }
          : { row: index + 1, user_id: resolvedUserIdString, ok: true },
      )
    }

    const succeeded = results.filter((row) => row.ok).length
    const failed = results.length - succeeded

    await writeAuditLog(admin, {
      adminUserId,
      action: 'BULK_IMPORT_USERS',
      success: failed === 0,
      metadata: {
        total: results.length,
        succeeded,
        failed,
      },
    })

    return json({
      success: true,
      summary: { total: results.length, succeeded, failed },
      results,
    })
  }

  if (action === 'IMPERSONATE_USER') {
    const userId = String(body.user_id ?? '')
    if (!userId) {
      return json({ error: 'Missing user_id' }, 400)
    }

    const userResult = await admin.auth.admin.getUserById(userId)
    if (userResult.error || !userResult.data.user?.email) {
      return json({ error: userResult.error?.message ?? 'User not found' }, 404)
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: userResult.data.user.email,
      options: {
        redirectTo: 'http://127.0.0.1:5173/auth',
      },
    })

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({
      success: true,
      user_id: userId,
      impersonation_url: data.properties?.action_link ?? null,
    })
  }

  if (action === 'GET_API_USAGE') {
    const limit = Math.min(500, Math.max(1, Number(body.limit ?? 200)))

    const { data, error } = await admin
      .from('api_usage')
      .select('id, api_key_id, endpoint, method, status_code, response_time_ms, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, usage: data ?? [] })
  }

  if (action === 'GET_WEBHOOK_FAILURES') {
    const limit = Math.min(300, Math.max(1, Number(body.limit ?? 100)))

    const { data, error } = await admin
      .from('webhook_deliveries')
      .select('id, webhook_id, event_type, payload, response_status, response_body, duration_ms, attempt_number, success, delivered_at')
      .eq('success', false)
      .order('delivered_at', { ascending: false })
      .limit(limit)

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, failures: data ?? [] })
  }

  if (action === 'RETRY_WEBHOOK_DELIVERY') {
    const deliveryId = String(body.delivery_id ?? '')
    if (!deliveryId) {
      return json({ error: 'Missing delivery_id' }, 400)
    }

    const { data: delivery, error: deliveryError } = await admin
      .from('webhook_deliveries')
      .select('id, webhook_id, event_type, payload, attempt_number')
      .eq('id', deliveryId)
      .maybeSingle<{ id: string; webhook_id: string; event_type: string; payload: Record<string, unknown>; attempt_number: number }>()

    if (deliveryError || !delivery) {
      return json({ error: deliveryError?.message ?? 'Delivery not found' }, 404)
    }

    const { data: webhook, error: webhookError } = await admin
      .from('webhooks')
      .select('id, url, secret')
      .eq('id', delivery.webhook_id)
      .maybeSingle<{ id: string; url: string; secret: string }>()

    if (webhookError || !webhook) {
      return json({ error: webhookError?.message ?? 'Webhook not found' }, 404)
    }

    const payload = delivery.payload
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const rawBody = JSON.stringify(payload)
    const signature = await signPayload(webhook.secret, `${timestamp}.${rawBody}`)

    const startedAt = performance.now()
    let responseStatus: number | null = null
    let responseBody = ''
    let ok = false

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Loyalup-Event': delivery.event_type,
          'X-Loyalup-Timestamp': timestamp,
          'X-Loyalup-Signature': `v1=${signature}`,
          'X-Loyalup-Webhook-Id': webhook.id,
        },
        body: rawBody,
      })

      responseStatus = response.status
      responseBody = await response.text()
      ok = response.ok
    } catch (error) {
      responseBody = error instanceof Error ? error.message : 'fetch_failed'
      ok = false
    }

    const duration = Math.round(performance.now() - startedAt)

    const insertResult = await admin.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event_type: delivery.event_type,
      payload,
      response_status: responseStatus,
      response_body: responseBody.slice(0, 4000),
      duration_ms: duration,
      attempt_number: Number(delivery.attempt_number ?? 0) + 1,
      success: ok,
    })

    if (insertResult.error) {
      await writeAuditLog(admin, {
        adminUserId,
        action: 'RETRY_WEBHOOK_DELIVERY',
        success: false,
        metadata: { delivery_id: deliveryId, error: insertResult.error.message },
      })
      return json({ error: insertResult.error.message }, 500)
    }

    await writeAuditLog(admin, {
      adminUserId,
      action: 'RETRY_WEBHOOK_DELIVERY',
      success: ok,
      metadata: {
        delivery_id: deliveryId,
        status_code: responseStatus,
        delivered: ok,
      },
    })

    return json({
      success: true,
      retried: true,
      status_code: responseStatus,
      delivered: ok,
    })
  }

  if (action === 'GET_AUDIT_LOGS') {
    const limit = Math.min(300, Math.max(1, Number(body.limit ?? 100)))

    const { data, error } = await admin
      .from('admin_audit_logs')
      .select('id, admin_user_id, action, target_user_id, success, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return json({ error: error.message }, 500)
    }

    return json({ success: true, logs: data ?? [] })
  }

  return json({ error: 'Unsupported action' }, 400)
})

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

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function applyRoleUpdate(
  admin: ReturnType<typeof createClient>,
  userId: string,
  role: 'client' | 'fournisseur' | 'admin',
): Promise<string | null> {
  const { data: existingUser, error: getUserError } = await admin.auth.admin.getUserById(userId)
  if (getUserError || !existingUser.user) {
    return getUserError?.message ?? 'User not found'
  }

  const { error: updateAuthError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...(existingUser.user.user_metadata ?? {}),
      role,
    },
    app_metadata: {
      ...(existingUser.user.app_metadata ?? {}),
      role,
    },
  })

  if (updateAuthError) {
    return updateAuthError.message
  }

  const email = existingUser.user.email ?? ''
  const nom = String(existingUser.user.user_metadata?.nom ?? email.split('@')[0] ?? 'User')

  const { error: profileUpsertError } = await admin
    .from('profiles')
    .upsert({ id: userId, email, nom, role }, { onConflict: 'id' })

  if (profileUpsertError) {
    return profileUpsertError.message
  }

  if (role === 'fournisseur') {
    const { error: providerUpsertError } = await admin
      .from('fournisseurs')
      .upsert({ user_id: userId, nom_commerce: nom, adresse: 'N/A' }, { onConflict: 'user_id' })

    if (providerUpsertError) {
      return providerUpsertError.message
    }
  }

  return null
}

async function applyBlockedUpdate(
  admin: ReturnType<typeof createClient>,
  userId: string,
  blocked: boolean,
): Promise<string | null> {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: blocked ? '876000h' : 'none',
  })

  return error ? error.message : null
}

async function writeAuditLog(
  admin: ReturnType<typeof createClient>,
  params: {
    adminUserId: string
    action: string
    targetUserId?: string
    success: boolean
    metadata?: Record<string, unknown>
  },
) {
  await admin.from('admin_audit_logs').insert({
    admin_user_id: params.adminUserId,
    action: params.action,
    target_user_id: params.targetUserId ?? null,
    success: params.success,
    metadata: params.metadata ?? {},
  })
}
