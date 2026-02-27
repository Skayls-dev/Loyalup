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
    email: `week5-ui-client-${randomSuffix()}@loyalup.test`,
    password: 'Test1234!',
    role: 'client',
    nom: 'Week5 UI Client',
  })

  const { data: providerRow, error: providerRowError } = await adminClient
    .from('fournisseurs')
    .select('id')
    .eq('user_id', provider.id)
    .single()

  if (providerRowError || !providerRow?.id) {
    throw providerRowError ?? new Error('Provider not found')
  }

  const fournisseurId = providerRow.id

  const enrollment = await adminClient.from('client_points').upsert(
    {
      client_id: client.id,
      fournisseur_id: fournisseurId,
      solde: 5,
      total_visites: 1,
    },
    { onConflict: 'client_id,fournisseur_id' },
  )

  if (enrollment.error) {
    throw enrollment.error
  }

  const promoCreate = await adminClient
    .from('promotions')
    .insert({
      fournisseur_id: fournisseurId,
      titre: `Promo UI ${randomSuffix()}`,
      description: 'Promo créée par smoke UI',
      emoji: '🔥',
      type: 'discount',
      valeur: 15,
      date_debut: new Date(Date.now() - 60_000).toISOString(),
      date_fin: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      actif: true,
    })
    .select('id, titre, actif')
    .single()

  if (promoCreate.error || !promoCreate.data?.id) {
    throw promoCreate.error ?? new Error('Create promotion failed')
  }

  const promoId = promoCreate.data.id

  const promoUpdate = await adminClient
    .from('promotions')
    .update({ titre: `${promoCreate.data.titre} (modifiée)` })
    .eq('id', promoId)
    .select('id, titre')
    .single()

  if (promoUpdate.error || !promoUpdate.data?.titre.includes('modifiée')) {
    throw promoUpdate.error ?? new Error('Update promotion failed')
  }

  const promoSoftDelete = await adminClient
    .from('promotions')
    .update({ actif: false })
    .eq('id', promoId)
    .select('id, actif')
    .single()

  if (promoSoftDelete.error || promoSoftDelete.data?.actif !== false) {
    throw promoSoftDelete.error ?? new Error('Soft delete promotion failed')
  }

  const serviceCreate = await adminClient
    .from('services')
    .insert({
      fournisseur_id: fournisseurId,
      nom: `Service UI ${randomSuffix()}`,
      emoji: '☕',
      prix_defaut: 5,
      points_defaut: 20,
      points_per_euro: 10,
      actif: true,
    })
    .select('id, actif, nom')
    .single()

  if (serviceCreate.error || !serviceCreate.data?.id) {
    throw serviceCreate.error ?? new Error('Create service failed')
  }

  const serviceId = serviceCreate.data.id

  const serviceUpdate = await adminClient
    .from('services')
    .update({ nom: `${serviceCreate.data.nom} (modifié)` })
    .eq('id', serviceId)
    .select('id, nom')
    .single()

  if (serviceUpdate.error || !serviceUpdate.data?.nom.includes('modifié')) {
    throw serviceUpdate.error ?? new Error('Update service failed')
  }

  const serviceToggle = await adminClient
    .from('services')
    .update({ actif: false })
    .eq('id', serviceId)
    .select('id, actif')
    .single()

  if (serviceToggle.error || serviceToggle.data?.actif !== false) {
    throw serviceToggle.error ?? new Error('Toggle service failed')
  }

  const rewardCreate = await adminClient
    .from('reward_rules')
    .insert({
      fournisseur_id: fournisseurId,
      nom: `Reward UI ${randomSuffix()}`,
      description: 'Reward smoke UI',
      points_required: 40,
      emoji: '🎁',
      actif: true,
    })
    .select('id, nom, actif')
    .single()

  if (rewardCreate.error || !rewardCreate.data?.id) {
    throw rewardCreate.error ?? new Error('Create reward rule failed')
  }

  const rewardId = rewardCreate.data.id

  const rewardUpdate = await adminClient
    .from('reward_rules')
    .update({ nom: `${rewardCreate.data.nom} (modifiée)` })
    .eq('id', rewardId)
    .select('id, nom')
    .single()

  if (rewardUpdate.error || !rewardUpdate.data?.nom.includes('modifiée')) {
    throw rewardUpdate.error ?? new Error('Update reward rule failed')
  }

  const rewardToggle = await adminClient
    .from('reward_rules')
    .update({ actif: false })
    .eq('id', rewardId)
    .select('id, actif')
    .single()

  if (rewardToggle.error || rewardToggle.data?.actif !== false) {
    throw rewardToggle.error ?? new Error('Toggle reward rule failed')
  }

  const activePromosForClientProviders = await adminClient
    .from('active_promotions')
    .select('id, fournisseur_id')
    .in('fournisseur_id', [fournisseurId])

  if (activePromosForClientProviders.error) {
    throw activePromosForClientProviders.error
  }

  const stats = await adminClient.rpc('get_provider_stats', {
    p_fournisseur_id: fournisseurId,
  })

  if (stats.error) {
    throw stats.error
  }

  const statsRow = Array.isArray(stats.data) ? stats.data[0] : stats.data
  if (!statsRow) {
    throw new Error('Provider stats row missing')
  }

  console.log('✅ Week 5 UI-flow smoke passed')
  console.log(
    JSON.stringify(
      {
        fournisseur_id: fournisseurId,
        client_id: client.id,
        active_promotions_visible_now: (activePromosForClientProviders.data ?? []).length,
        provider_stats: {
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
  console.error('❌ Week 5 UI-flow smoke failed')
  console.error(error)
  process.exit(1)
})
