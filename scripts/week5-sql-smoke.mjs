import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

function parseEnvValue(raw, key) {
  const match = raw.match(new RegExp(`${key}="([^"]+)"`))
  if (!match?.[1]) {
    throw new Error(`Missing ${key}`)
  }

  return match[1].replace(/\s+/g, '')
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 7)
}

async function ensureUser(adminClient, { email, password, role, nom }) {
  const createResult = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, nom },
  })

  if (createResult.error && !createResult.error.message.toLowerCase().includes('already')) {
    throw createResult.error
  }

  let user = createResult.data.user

  if (!user) {
    const listed = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listed.error) {
      throw listed.error
    }

    user = listed.data.users.find((item) => item.email === email) ?? null
  }

  if (!user?.id) {
    throw new Error(`Unable to resolve user id for ${email}`)
  }

  const { error: profileError } = await adminClient.from('profiles').upsert(
    {
      id: user.id,
      email,
      role,
      nom,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    throw profileError
  }

  if (role === 'fournisseur') {
    const { error: providerError } = await adminClient.from('fournisseurs').upsert(
      {
        user_id: user.id,
        nom_commerce: nom,
        adresse: 'N/A',
      },
      { onConflict: 'user_id' },
    )

    if (providerError) {
      throw providerError
    }
  }

  return { id: user.id, email }
}

async function main() {
  const envRaw = execSync('npx supabase status -o env', { encoding: 'utf8' })
  const url = parseEnvValue(envRaw, 'API_URL')
  const serviceRoleKey = parseEnvValue(envRaw, 'SERVICE_ROLE_KEY')

  const adminClient = createClient(url, serviceRoleKey)

  const provider = await ensureUser(adminClient, {
    email: 'provider1@loyalup.test',
    password: 'Test1234!',
    role: 'fournisseur',
    nom: 'Provider One',
  })

  const client = await ensureUser(adminClient, {
    email: `week5-client-${randomSuffix()}@loyalup.test`,
    password: 'Test1234!',
    role: 'client',
    nom: 'Week5 Client',
  })

  const { data: providerRow, error: providerRowError } = await adminClient
    .from('fournisseurs')
    .select('id')
    .eq('user_id', provider.id)
    .single()

  if (providerRowError || !providerRow?.id) {
    throw providerRowError ?? new Error('Provider row missing')
  }

  const fournisseurId = providerRow.id

  const serviceInsert = await adminClient
    .from('services')
    .insert({
      fournisseur_id: fournisseurId,
      nom: `Service Week5 ${randomSuffix()}`,
      emoji: '☕',
      prix_defaut: 4,
      points_defaut: 15,
      points_per_euro: 10,
      actif: true,
    })
    .select('id')
    .single()

  if (serviceInsert.error || !serviceInsert.data?.id) {
    throw serviceInsert.error ?? new Error('Failed to insert service')
  }

  const qrInsert = await adminClient
    .from('qr_tokens')
    .insert({
      fournisseur_id: fournisseurId,
      token: crypto.randomUUID(),
      status: 'used',
      expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (qrInsert.error || !qrInsert.data?.id) {
    throw qrInsert.error ?? new Error('Failed to insert qr token')
  }

  const pendingInsert = await adminClient
    .from('pending_transactions')
    .insert({
      qr_token_id: qrInsert.data.id,
      client_id: client.id,
      fournisseur_id: fournisseurId,
      status: 'validated',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (pendingInsert.error || !pendingInsert.data?.id) {
    throw pendingInsert.error ?? new Error('Failed to insert pending transaction')
  }

  const pointsUpsert = await adminClient.from('client_points').upsert(
    {
      client_id: client.id,
      fournisseur_id: fournisseurId,
      solde: 25,
      total_visites: 3,
    },
    { onConflict: 'client_id,fournisseur_id' },
  )

  if (pointsUpsert.error) {
    throw pointsUpsert.error
  }

  const txnInsert = await adminClient.from('transactions').insert({
    pending_transaction_id: pendingInsert.data.id,
    client_id: client.id,
    fournisseur_id: fournisseurId,
    service_id: serviceInsert.data.id,
    montant: 12,
    points_credited: 30,
    status: 'validated',
  })

  if (txnInsert.error) {
    throw txnInsert.error
  }

  const now = Date.now()
  const promoInsert = await adminClient
    .from('promotions')
    .insert({
      fournisseur_id: fournisseurId,
      titre: `Promo Week5 ${randomSuffix()}`,
      description: 'Promo smoke test',
      emoji: '🔥',
      type: 'discount',
      valeur: 20,
      date_debut: new Date(now - 60 * 60 * 1000).toISOString(),
      date_fin: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
      actif: true,
    })
    .select('id')
    .single()

  if (promoInsert.error || !promoInsert.data?.id) {
    throw promoInsert.error ?? new Error('Failed to insert promotion')
  }

  const activePromos = await adminClient
    .from('active_promotions')
    .select('id, fournisseur_id, titre')
    .eq('fournisseur_id', fournisseurId)

  if (activePromos.error || (activePromos.data ?? []).length === 0) {
    throw activePromos.error ?? new Error('No active promotions found in active_promotions view')
  }

  const providerStats = await adminClient.rpc('get_provider_stats', {
    p_fournisseur_id: fournisseurId,
  })

  if (providerStats.error) {
    throw providerStats.error
  }

  const statsRow = Array.isArray(providerStats.data) ? providerStats.data[0] : providerStats.data

  if (!statsRow) {
    throw new Error('No stats row returned')
  }

  console.log('✅ Week 5 SQL smoke passed')
  console.log(
    JSON.stringify(
      {
        fournisseur_id: fournisseurId,
        active_promotions_count: (activePromos.data ?? []).length,
        stats: {
          total_clients: Number(statsRow.total_clients ?? 0),
          total_transactions: Number(statsRow.total_transactions ?? 0),
          total_points_distributed: Number(statsRow.total_points_distributed ?? 0),
          transactions_today: Number(statsRow.transactions_today ?? 0),
          revenue_today: Number(statsRow.revenue_today ?? 0),
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error('❌ Week 5 SQL smoke failed')
  console.error(error)
  process.exit(1)
})
