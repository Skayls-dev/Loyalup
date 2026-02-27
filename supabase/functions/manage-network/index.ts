import { createClient } from 'npm:@supabase/supabase-js@2'

type ManageNetworkAction =
  | 'CREATE_NETWORK'
  | 'UPDATE_NETWORK'
  | 'DELETE_NETWORK'
  | 'UPLOAD_LOGO'
  | 'UPLOAD_BANNER'
  | 'GET_STATS'

type JsonRecord = Record<string, unknown>

type ManageNetworkBody = {
  action?: ManageNetworkAction
  network_id?: string
  slug?: string
  payload?: JsonRecord
  file_base64?: string
  file_mime_type?: string
  bucket?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NETWORK_BUCKET_DEFAULT = 'network-assets'

const NETWORK_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function sanitizeSlug(value: string): string {
  return value.trim().toLowerCase()
}

function generateInviteCode(prefix = 'NET'): string {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `${prefix.toUpperCase()}-${random}`
}

function decodeBase64File(input: string): Uint8Array {
  const normalized = input.includes(',') ? input.split(',').pop() ?? '' : input
  const raw = atob(normalized)
  const bytes = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }

  return bytes
}

async function getAdminContext(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null, userId: null }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  const authClient = createClient(supabaseUrl, anonKey)
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user?.id) {
    return { error: json({ error: 'Unauthorized' }, 401), admin: null, userId: null }
  }

  const adminUserId = userData.user.id

  const { data: profile, error: roleError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', adminUserId)
    .maybeSingle<{ role: string }>()

  if (roleError || profile?.role !== 'admin') {
    return { error: json({ error: 'Forbidden' }, 403), admin: null, userId: null }
  }

  return { error: null, admin, userId: adminUserId }
}

async function notifyNetworkProviders(params: {
  admin: ReturnType<typeof createClient>
  networkId: string
  title: string
  body: string
  type: string
}) {
  const { admin, networkId, title, body, type } = params

  const { data: members } = await admin
    .from('network_members')
    .select('fournisseur_id')
    .eq('network_id', networkId)
    .eq('status', 'active')

  const providerIds = (members ?? []).map((row) => row.fournisseur_id as string).filter(Boolean)
  if (providerIds.length === 0) {
    return
  }

  const { data: providers } = await admin.from('fournisseurs').select('id, user_id').in('id', providerIds)

  const userIds = (providers ?? []).map((row) => row.user_id as string).filter(Boolean)
  if (userIds.length === 0) {
    return
  }

  const rows = userIds.map((userId) => ({
    user_id: userId,
    title,
    body,
    type,
    data: { network_id: networkId },
  }))

  await admin.from('notifications').insert(rows)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const context = await getAdminContext(req)
  if (context.error || !context.admin || !context.userId) {
    return context.error ?? json({ error: 'Unauthorized' }, 401)
  }

  const { admin, userId } = context

  let body: ManageNetworkBody
  try {
    body = (await req.json()) as ManageNetworkBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const action = body.action
  if (!action) {
    return json({ error: 'Missing action' }, 400)
  }

  if (action === 'CREATE_NETWORK') {
    const payload = (body.payload ?? {}) as JsonRecord
    const slug = sanitizeSlug(String(payload.slug ?? body.slug ?? ''))
    const name = payload.name
    const emoji = String(payload.emoji ?? '')
    const primaryColor = String(payload.primary_color ?? '')
    const category = String(payload.category ?? '')

    if (!slug || !name || !emoji || !primaryColor || !category) {
      return json({ error: 'Missing required fields: slug, name, emoji, primary_color, category' }, 400)
    }

    if (!NETWORK_SLUG_REGEX.test(slug)) {
      return json({ error: 'Invalid slug format' }, 400)
    }

    const { data: existingSlug, error: slugError } = await admin
      .from('networks')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (slugError) {
      return json({ error: slugError.message }, 500)
    }

    if (existingSlug?.id) {
      return json({ error: 'Slug already exists' }, 409)
    }

    const clientAccess = String(payload.client_access ?? 'open')
    const insertPayload: JsonRecord = {
      ...payload,
      slug,
      created_by: userId,
    }

    if (clientAccess === 'invite' && !insertPayload.client_invite_code) {
      insertPayload.client_invite_code = generateInviteCode('CLI')
    }

    const { data: inserted, error: insertError } = await admin
      .from('networks')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError) {
      return json({ error: insertError.message }, 500)
    }

    return json({ network: inserted })
  }

  if (action === 'UPDATE_NETWORK') {
    const networkId = String(body.network_id ?? body.payload?.id ?? '')
    const payload = (body.payload ?? {}) as JsonRecord

    if (!networkId) {
      return json({ error: 'network_id is required' }, 400)
    }

    const { data: current, error: currentError } = await admin
      .from('networks')
      .select('id, slug, name, points_multiplier')
      .eq('id', networkId)
      .maybeSingle<{ id: string; slug: string; name: Record<string, string> | null; points_multiplier: number }>()

    if (currentError || !current?.id) {
      return json({ error: currentError?.message ?? 'Network not found' }, 404)
    }

    if (payload.slug) {
      const slug = sanitizeSlug(String(payload.slug))
      if (!NETWORK_SLUG_REGEX.test(slug)) {
        return json({ error: 'Invalid slug format' }, 400)
      }

      const { data: duplicate } = await admin
        .from('networks')
        .select('id')
        .eq('slug', slug)
        .neq('id', networkId)
        .maybeSingle()

      if (duplicate?.id) {
        return json({ error: 'Slug already exists' }, 409)
      }

      payload.slug = slug
    }

    const { data: updated, error: updateError } = await admin
      .from('networks')
      .update(payload)
      .eq('id', networkId)
      .select('*')
      .single()

    if (updateError) {
      return json({ error: updateError.message }, 500)
    }

    const prevMultiplier = Number(current.points_multiplier ?? 1)
    const nextMultiplier = Number((updated as Record<string, unknown>).points_multiplier ?? prevMultiplier)

    if (prevMultiplier !== nextMultiplier) {
      await admin.from('network_multiplier_audit_logs').insert({
        network_id: networkId,
        previous_multiplier: prevMultiplier,
        new_multiplier: nextMultiplier,
        changed_by: userId,
        reason: 'Updated via manage-network/UPDATE_NETWORK',
      })

      const networkName =
        ((current.name ?? {}) as Record<string, string>).fr ??
        ((current.name ?? {}) as Record<string, string>).en ??
        current.slug

      await notifyNetworkProviders({
        admin,
        networkId,
        title: '🔔 Mise à jour réseau',
        body: `${networkName}: multiplicateur mis à jour (${prevMultiplier}x → ${nextMultiplier}x)`,
        type: 'network_multiplier_changed',
      })
    }

    return json({ network: updated })
  }

  if (action === 'DELETE_NETWORK') {
    const networkId = String(body.network_id ?? '')
    if (!networkId) {
      return json({ error: 'network_id is required' }, 400)
    }

    const { data: current, error: currentError } = await admin
      .from('networks')
      .select('id, slug, name')
      .eq('id', networkId)
      .maybeSingle<{ id: string; slug: string; name: Record<string, string> | null }>()

    if (currentError || !current?.id) {
      return json({ error: currentError?.message ?? 'Network not found' }, 404)
    }

    const { error: deactivateError } = await admin
      .from('networks')
      .update({
        is_active: false,
        is_draft: false,
      })
      .eq('id', networkId)

    if (deactivateError) {
      return json({ error: deactivateError.message }, 500)
    }

    const networkName =
      ((current.name ?? {}) as Record<string, string>).fr ??
      ((current.name ?? {}) as Record<string, string>).en ??
      current.slug

    await notifyNetworkProviders({
      admin,
      networkId,
      title: '📴 Réseau désactivé',
      body: `${networkName} a été désactivé par l'administration.`,
      type: 'network_deleted',
    })

    return json({ success: true })
  }

  if (action === 'UPLOAD_LOGO' || action === 'UPLOAD_BANNER') {
    const networkId = String(body.network_id ?? '')
    const fileBase64 = String(body.file_base64 ?? '')
    const mimeType = String(body.file_mime_type ?? 'image/webp')
    const bucket = String(body.bucket ?? NETWORK_BUCKET_DEFAULT)

    if (!networkId || !fileBase64) {
      return json({ error: 'network_id and file_base64 are required' }, 400)
    }

    const { data: network, error: networkError } = await admin
      .from('networks')
      .select('id, slug')
      .eq('id', networkId)
      .maybeSingle<{ id: string; slug: string }>()

    if (networkError || !network?.id) {
      return json({ error: networkError?.message ?? 'Network not found' }, 404)
    }

    const path =
      action === 'UPLOAD_LOGO'
        ? `networks/${network.slug}/logo.webp`
        : `networks/${network.slug}/banner.webp`

    const bytes = decodeBase64File(fileBase64)

    const { error: uploadError } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
    })

    if (uploadError) {
      return json({ error: uploadError.message }, 500)
    }

    const { data: publicUrlData } = admin.storage.from(bucket).getPublicUrl(path)
    const publicUrl = publicUrlData.publicUrl

    const updatePayload =
      action === 'UPLOAD_LOGO'
        ? { logo_url: publicUrl }
        : { banner_url: publicUrl }

    const { error: persistError } = await admin.from('networks').update(updatePayload).eq('id', networkId)

    if (persistError) {
      return json({ error: persistError.message }, 500)
    }

    if (action === 'UPLOAD_LOGO') {
      return json({ logo_url: publicUrl })
    }

    return json({ banner_url: publicUrl })
  }

  if (action === 'GET_STATS') {
    const networkId = String(body.network_id ?? '')
    if (!networkId) {
      return json({ error: 'network_id is required' }, 400)
    }

    const [
      memberCount,
      clientCount,
      bonusAggregate,
      txWithBonus,
      topProviders,
      clientGrowth,
      countryRows,
    ] = await Promise.all([
      admin.from('network_members').select('id', { head: true, count: 'exact' }).eq('network_id', networkId).eq('status', 'active'),
      admin.from('network_clients').select('id', { head: true, count: 'exact' }).eq('network_id', networkId),
      admin
        .from('network_point_events')
        .select('bonus_points')
        .eq('network_id', networkId),
      admin
        .from('network_point_events')
        .select('id', { head: true, count: 'exact' })
        .eq('network_id', networkId),
      admin
        .from('network_members')
        .select('fournisseur_id, fournisseurs!inner(nom_commerce, adresse)')
        .eq('network_id', networkId)
        .eq('status', 'active')
        .limit(10),
      admin
        .from('network_clients')
        .select('joined_at')
        .eq('network_id', networkId)
        .gte('joined_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      admin
        .from('network_members')
        .select('fournisseurs!inner(adresse)')
        .eq('network_id', networkId)
        .eq('status', 'active'),
    ])

    const totalBonusPoints = ((bonusAggregate.data ?? []) as Array<{ bonus_points: number }>).reduce(
      (sum, row) => sum + Number(row.bonus_points ?? 0),
      0,
    )

    const txCount = txWithBonus.count ?? 0

    const providerRows = (topProviders.data ?? []) as Array<{
      fournisseur_id: string
      fournisseurs: { nom_commerce?: string; adresse?: string }[] | { nom_commerce?: string; adresse?: string } | null
    }>

    const topProvidersByClients = providerRows.map((row) => {
      const provider = Array.isArray(row.fournisseurs) ? row.fournisseurs[0] : row.fournisseurs
      return {
        fournisseur_id: row.fournisseur_id,
        provider_name: provider?.nom_commerce ?? 'Commerce',
        address: provider?.adresse ?? null,
      }
    })

    const countriesRaw = (countryRows.data ?? []) as Array<{
      fournisseurs: { adresse?: string }[] | { adresse?: string } | null
    }>

    const countryCount = new Map<string, number>()

    for (const row of countriesRaw) {
      const provider = Array.isArray(row.fournisseurs) ? row.fournisseurs[0] : row.fournisseurs
      const address = provider?.adresse ?? ''
      const parts = address.split(',').map((value) => value.trim()).filter(Boolean)
      const country = parts.length > 0 ? parts[parts.length - 1] : 'Unknown'
      countryCount.set(country, (countryCount.get(country) ?? 0) + 1)
    }

    const mostActiveCountries = Array.from(countryCount.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 10)

    return json({
      member_count: memberCount.count ?? 0,
      client_count: clientCount.count ?? 0,
      total_bonus_points_distributed: totalBonusPoints,
      total_transactions_with_bonus: txCount,
      avg_bonus_per_transaction: txCount > 0 ? totalBonusPoints / txCount : 0,
      top_providers_by_clients: topProvidersByClients,
      client_growth_last_30d: (clientGrowth.data ?? []).length,
      most_active_countries: mostActiveCountries,
    })
  }

  return json({ error: `Unsupported action: ${action}` }, 400)
})
