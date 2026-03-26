import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

function parseEnvValue(raw, key) {
  const match = raw.match(new RegExp(`${key}="([^"]+)"`))
  if (!match?.[1]) {
    throw new Error(`Missing ${key} in supabase status output`)
  }

  return match[1].trim()
}

function resolveAdminCredentials() {
  const envUrl = process.env.VITE_SUPABASE_URL?.trim()
  const envServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (envUrl && envServiceRoleKey) {
    return { supabaseUrl: envUrl, serviceRoleKey: envServiceRoleKey }
  }

  const envRaw = execSync('npx supabase status -o env', {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  return {
    supabaseUrl: parseEnvValue(envRaw, 'API_URL'),
    serviceRoleKey: parseEnvValue(envRaw, 'SERVICE_ROLE_KEY').replace(/\s+/g, ''),
  }
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

async function findUserByEmail(adminClient, email) {
  const listed = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) {
    throw listed.error
  }

  return listed.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function ensureNamedService(adminClient, fournisseurId, payload) {
  const existing = await adminClient
    .from('services')
    .select('id, nom')
    .eq('fournisseur_id', fournisseurId)
    .eq('nom', payload.nom)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  if (existing.data?.id) {
    return existing.data.id
  }

  const inserted = await adminClient
    .from('services')
    .insert({
      fournisseur_id: fournisseurId,
      ...payload,
    })
    .select('id')
    .single()

  if (inserted.error || !inserted.data?.id) {
    throw inserted.error ?? new Error(`Failed to insert service ${payload.nom}`)
  }

  return inserted.data.id
}

async function ensureNamedReward(adminClient, fournisseurId, payload) {
  const existing = await adminClient
    .from('reward_rules')
    .select('id, nom')
    .eq('fournisseur_id', fournisseurId)
    .eq('nom', payload.nom)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  if (existing.data?.id) {
    return existing.data.id
  }

  const inserted = await adminClient
    .from('reward_rules')
    .insert({
      fournisseur_id: fournisseurId,
      ...payload,
    })
    .select('id')
    .single()

  if (inserted.error || !inserted.data?.id) {
    throw inserted.error ?? new Error(`Failed to insert reward ${payload.nom}`)
  }

  return inserted.data.id
}

async function ensureNamedPromotion(adminClient, fournisseurId, payload) {
  const existing = await adminClient
    .from('promotions')
    .select('id, titre')
    .eq('fournisseur_id', fournisseurId)
    .eq('titre', payload.titre)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  if (existing.data?.id) {
    return existing.data.id
  }

  const inserted = await adminClient
    .from('promotions')
    .insert({
      fournisseur_id: fournisseurId,
      ...payload,
    })
    .select('id')
    .single()

  if (inserted.error || !inserted.data?.id) {
    throw inserted.error ?? new Error(`Failed to insert promotion ${payload.titre}`)
  }

  return inserted.data.id
}

async function createValidatedTransaction(adminClient, { fournisseurId, clientId, serviceId, montant, points }) {
  const qrToken = await adminClient
    .from('qr_tokens')
    .insert({
      fournisseur_id: fournisseurId,
      token: crypto.randomUUID(),
      status: 'used',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (qrToken.error || !qrToken.data?.id) {
    throw qrToken.error ?? new Error('Failed to create qr token')
  }

  const pending = await adminClient
    .from('pending_transactions')
    .insert({
      qr_token_id: qrToken.data.id,
      client_id: clientId,
      fournisseur_id: fournisseurId,
      status: 'validated',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (pending.error || !pending.data?.id) {
    throw pending.error ?? new Error('Failed to create pending transaction')
  }

  const inserted = await adminClient
    .from('transactions')
    .insert({
      pending_transaction_id: pending.data.id,
      client_id: clientId,
      fournisseur_id: fournisseurId,
      service_id: serviceId,
      montant,
      points_credited: points,
      status: 'validated',
      transaction_type: 'purchase',
    })
    .select('id')
    .single()

  if (inserted.error || !inserted.data?.id) {
    throw inserted.error ?? new Error('Failed to create validated transaction')
  }

  return inserted.data.id
}

async function seedForPair(adminClient, { clientId, fournisseurId, serviceIds }) {
  const pointsUpsert = await adminClient.from('client_points').upsert(
    {
      client_id: clientId,
      fournisseur_id: fournisseurId,
      solde: 120,
      total_visites: 8,
    },
    { onConflict: 'client_id,fournisseur_id' },
  )

  if (pointsUpsert.error) {
    throw pointsUpsert.error
  }

  const firstTxId = await createValidatedTransaction(adminClient, {
    fournisseurId,
    clientId,
    serviceId: serviceIds[0],
    montant: 12,
    points: 24,
  })

  const secondTxId = await createValidatedTransaction(adminClient, {
    fournisseurId,
    clientId,
    serviceId: serviceIds[1],
    montant: 18,
    points: 36,
  })

  return [firstTxId, secondTxId]
}

async function upsertMerchantRating(adminClient, { transactionId, rating, comment }) {
  const upsert = await adminClient
    .from('merchant_ratings')
    .upsert(
      {
        transaction_id: transactionId,
        rating,
        comment,
      },
      { onConflict: 'transaction_id' },
    )

  if (upsert.error) {
    throw upsert.error
  }
}

async function upsertClientReward(adminClient, { clientId, fournisseurId, rewardRuleId, status, usedAt = null }) {
  const upsert = await adminClient
    .from('client_rewards')
    .upsert(
      {
        client_id: clientId,
        fournisseur_id: fournisseurId,
        reward_rule_id: rewardRuleId,
        status,
        used_at: usedAt,
      },
      { onConflict: 'client_id,reward_rule_id' },
    )

  if (upsert.error) {
    throw upsert.error
  }
}

async function setConsents(adminClient, userId) {
  const nowIso = new Date().toISOString()
  const policyVersion = '2026.02'

  const consents = [
    { consent_type: 'essential', granted: true },
    { consent_type: 'analytics', granted: true },
    { consent_type: 'marketing', granted: false },
    { consent_type: 'third_party', granted: false },
  ]

  for (const consent of consents) {
    const upsert = await adminClient.from('user_consents').upsert(
      {
        user_id: userId,
        consent_type: consent.consent_type,
        granted: consent.granted,
        policy_version: policyVersion,
        granted_at: nowIso,
        revoked_at: consent.granted ? null : nowIso,
        user_agent: 'seed-test-data-script',
      },
      { onConflict: 'user_id,consent_type,policy_version' },
    )

    if (upsert.error) {
      throw upsert.error
    }
  }
}

async function addUserEvent(adminClient, userId, eventType, page) {
  const inserted = await adminClient.from('user_events').insert({
    user_id: userId,
    session_id: crypto.randomUUID(),
    event_type: eventType,
    properties: { source: 'seed-test-data' },
    page,
    device_type: 'desktop',
    app_version: 'local-seed',
  })

  if (inserted.error) {
    throw inserted.error
  }
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = resolveAdminCredentials()

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const users = {
    client1: await findUserByEmail(adminClient, 'client1@loyalup.test'),
    client2: await findUserByEmail(adminClient, 'client2@loyalup.test'),
    provider1: await findUserByEmail(adminClient, 'provider1@loyalup.test'),
    provider2: await findUserByEmail(adminClient, 'provider2@loyalup.test'),
  }

  for (const [key, user] of Object.entries(users)) {
    if (!user?.id) {
      throw new Error(`Missing required user: ${key}`)
    }
  }

  const providerRows = {
    provider1: await adminClient.from('fournisseurs').select('id').eq('user_id', users.provider1.id).single(),
    provider2: await adminClient.from('fournisseurs').select('id').eq('user_id', users.provider2.id).single(),
  }

  if (providerRows.provider1.error || !providerRows.provider1.data?.id) {
    throw providerRows.provider1.error ?? new Error('Missing fournisseur row for provider1')
  }
  if (providerRows.provider2.error || !providerRows.provider2.data?.id) {
    throw providerRows.provider2.error ?? new Error('Missing fournisseur row for provider2')
  }

  const fournisseur1Id = providerRows.provider1.data.id
  const fournisseur2Id = providerRows.provider2.data.id

  const p1ServiceA = await ensureNamedService(adminClient, fournisseur1Id, {
    nom: 'Espresso Test',
    emoji: '☕',
    prix_defaut: 3,
    points_defaut: 10,
    points_per_euro: 10,
    actif: true,
  })

  const p1ServiceB = await ensureNamedService(adminClient, fournisseur1Id, {
    nom: 'Menu Lunch Test',
    emoji: '🍽️',
    prix_defaut: 12,
    points_defaut: 30,
    points_per_euro: 10,
    actif: true,
  })

  const p2ServiceA = await ensureNamedService(adminClient, fournisseur2Id, {
    nom: 'Lavande Relax Test',
    emoji: '🧴',
    prix_defaut: 22,
    points_defaut: 40,
    points_per_euro: 8,
    actif: true,
  })

  const p2ServiceB = await ensureNamedService(adminClient, fournisseur2Id, {
    nom: 'Coupe Premium Test',
    emoji: '✂️',
    prix_defaut: 28,
    points_defaut: 50,
    points_per_euro: 8,
    actif: true,
  })

  const reward1Id = await ensureNamedReward(adminClient, fournisseur1Id, {
    nom: 'Boisson offerte Test',
    description: '1 boisson offerte après cumul de points',
    points_required: 100,
    emoji: '🎁',
    reward_delivery_type: 'in_store',
    actif: true,
  })

  const reward2Id = await ensureNamedReward(adminClient, fournisseur2Id, {
    nom: 'Soin découverte Test',
    description: 'Réduction sur soin découverte',
    points_required: 150,
    emoji: '✨',
    reward_delivery_type: 'digital_code',
    actif: true,
  })

  const now = Date.now()
  await ensureNamedPromotion(adminClient, fournisseur1Id, {
    titre: 'Happy Hour Test Data',
    description: '20% sur les boissons chaudes',
    emoji: '🔥',
    type: 'discount',
    valeur: 20,
    date_debut: new Date(now - 60 * 60 * 1000).toISOString(),
    date_fin: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
    actif: true,
  })

  await ensureNamedPromotion(adminClient, fournisseur2Id, {
    titre: `Pack Beauté Test ${randomSuffix()}`,
    description: 'Offre de lancement locale',
    emoji: '💄',
    type: 'double_points',
    valeur: 30,
    date_debut: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    date_fin: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    actif: true,
  })

  const p1c1Transactions = await seedForPair(adminClient, {
    clientId: users.client1.id,
    fournisseurId: fournisseur1Id,
    serviceIds: [p1ServiceA, p1ServiceB],
  })

  const p1c2Transactions = await seedForPair(adminClient, {
    clientId: users.client2.id,
    fournisseurId: fournisseur1Id,
    serviceIds: [p1ServiceA, p1ServiceB],
  })

  const p2c1Transactions = await seedForPair(adminClient, {
    clientId: users.client1.id,
    fournisseurId: fournisseur2Id,
    serviceIds: [p2ServiceA, p2ServiceB],
  })

  const p2c2Transactions = await seedForPair(adminClient, {
    clientId: users.client2.id,
    fournisseurId: fournisseur2Id,
    serviceIds: [p2ServiceA, p2ServiceB],
  })

  await upsertMerchantRating(adminClient, {
    transactionId: p1c1Transactions[1],
    rating: 5,
    comment: 'Service rapide et accueillant.',
  })
  await upsertMerchantRating(adminClient, {
    transactionId: p1c2Transactions[1],
    rating: 4,
    comment: 'Très bon rapport qualité prix.',
  })
  await upsertMerchantRating(adminClient, {
    transactionId: p2c1Transactions[1],
    rating: 5,
    comment: 'Expérience premium, je recommande.',
  })
  await upsertMerchantRating(adminClient, {
    transactionId: p2c2Transactions[1],
    rating: 4,
    comment: 'Personnel attentif et professionnel.',
  })

  const nowIso = new Date().toISOString()
  await upsertClientReward(adminClient, {
    clientId: users.client1.id,
    fournisseurId: fournisseur1Id,
    rewardRuleId: reward1Id,
    status: 'used',
    usedAt: nowIso,
  })
  await upsertClientReward(adminClient, {
    clientId: users.client2.id,
    fournisseurId: fournisseur1Id,
    rewardRuleId: reward1Id,
    status: 'available',
  })
  await upsertClientReward(adminClient, {
    clientId: users.client1.id,
    fournisseurId: fournisseur2Id,
    rewardRuleId: reward2Id,
    status: 'used',
    usedAt: nowIso,
  })
  await upsertClientReward(adminClient, {
    clientId: users.client2.id,
    fournisseurId: fournisseur2Id,
    rewardRuleId: reward2Id,
    status: 'available',
  })

  await setConsents(adminClient, users.client1.id)
  await setConsents(adminClient, users.client2.id)
  await setConsents(adminClient, users.provider1.id)
  await setConsents(adminClient, users.provider2.id)

  await addUserEvent(adminClient, users.client1.id, 'client.profile_viewed', '/client/profile')
  await addUserEvent(adminClient, users.client2.id, 'client.card_viewed', '/client')
  await addUserEvent(adminClient, users.provider1.id, 'provider.dashboard_viewed', '/provider')
  await addUserEvent(adminClient, users.provider2.id, 'provider.clients_viewed', '/provider?tab=clients')

  const summaries = await Promise.all([
    adminClient.from('services').select('*', { count: 'exact', head: true }),
    adminClient.from('promotions').select('*', { count: 'exact', head: true }),
    adminClient.from('transactions').select('*', { count: 'exact', head: true }),
    adminClient.from('client_points').select('*', { count: 'exact', head: true }),
    adminClient.from('reward_rules').select('*', { count: 'exact', head: true }),
    adminClient.from('client_rewards').select('*', { count: 'exact', head: true }),
    adminClient.from('merchant_ratings').select('*', { count: 'exact', head: true }),
    adminClient.from('user_consents').select('*', { count: 'exact', head: true }),
    adminClient.from('user_events').select('*', { count: 'exact', head: true }),
  ])

  const [services, promotions, transactions, clientPoints, rewards, clientRewards, merchantRatings, consents, events] = summaries

  console.log('Seed complete')
  console.log(`services=${services.count ?? 0}`)
  console.log(`promotions=${promotions.count ?? 0}`)
  console.log(`transactions=${transactions.count ?? 0}`)
  console.log(`client_points=${clientPoints.count ?? 0}`)
  console.log(`reward_rules=${rewards.count ?? 0}`)
  console.log(`client_rewards=${clientRewards.count ?? 0}`)
  console.log(`merchant_ratings=${merchantRatings.count ?? 0}`)
  console.log(`user_consents=${consents.count ?? 0}`)
  console.log(`user_events=${events.count ?? 0}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
