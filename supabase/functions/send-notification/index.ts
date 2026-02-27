import { createClient } from 'npm:@supabase/supabase-js@2'

type NotificationType =
  | 'network_joined'
  | 'network_bonus'
  | 'network_announcement'
  | 'membership_validated'
  | 'membership_rejected'
  | 'new_network_member'
  | 'generic'

type Body = {
  user_id?: string
  user_ids?: string[]
  type?: NotificationType
  title?: string
  body?: string
  data?: Record<string, unknown>
  network_name?: string
  network_emoji?: string
  points?: number
  provider_name?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function resolveTemplate(body: Body): { title: string; content: string } {
  const networkName = body.network_name ?? 'Network'
  const emoji = body.network_emoji ?? '✨'
  const points = Number(body.points ?? 0)
  const providerName = body.provider_name ?? 'Un commerce'

  switch (body.type) {
    case 'network_joined':
      return { title: '🎉 Bienvenue réseau', content: `🎉 Bienvenue dans ${networkName}!` }
    case 'network_bonus':
      return { title: '✨ Bonus réseau', content: `✨ +${points} pts bonus réseau aujourd'hui` }
    case 'network_announcement':
      return { title: `${emoji} ${networkName}`, content: body.body ?? `${emoji} ${networkName}: nouvelle annonce` }
    case 'membership_validated':
      return { title: '🎊 Demande validée', content: `🎊 Votre demande ${networkName} acceptée!` }
    case 'membership_rejected':
      return { title: '⚠️ Demande refusée', content: `${networkName}: demande non retenue` }
    case 'new_network_member':
      return { title: '🆕 Nouveau membre', content: `${providerName} a rejoint ${networkName}!` }
    default:
      return {
        title: body.title ?? 'Notification',
        content: body.body ?? 'Nouvelle notification',
      }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing env vars' }, 500)
  }

  const client = createClient(supabaseUrl, serviceRoleKey)

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const recipients = body.user_ids?.length ? body.user_ids : body.user_id ? [body.user_id] : []

  if (recipients.length === 0) {
    return json({ error: 'At least one recipient is required' }, 400)
  }

  const { title, content } = resolveTemplate(body)

  const { data: consentRows } = await client
    .from('user_consents')
    .select('user_id, consent_type, granted, granted_at')
    .in('user_id', recipients)
    .eq('consent_type', 'essential')
    .order('granted_at', { ascending: false })

  const blockedUsers = new Set<string>()
  for (const row of consentRows ?? []) {
    if (row.granted === false) {
      blockedUsers.add(String(row.user_id))
    }
  }

  const allowedRecipients = recipients.filter((userId) => !blockedUsers.has(userId))

  if (allowedRecipients.length === 0) {
    return json({ success: true, sent: 0, skipped: recipients.length })
  }

  const rows = allowedRecipients.map((userId) => ({
    user_id: userId,
    type: body.type ?? 'generic',
    title,
    body: content,
    data: body.data ?? {},
  }))

  const { error } = await client.from('notifications').insert(rows)
  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ success: true, sent: allowedRecipients.length, skipped: recipients.length - allowedRecipients.length })
})
