import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

function parseEnvValue(raw, key) {
  const match = raw.match(new RegExp(`${key}="([^"]+)"`))
  if (!match?.[1]) {
    throw new Error(`Missing ${key} in supabase status output`)
  }

  return match[1].trim()
}

async function findUserByEmail(adminClient, email) {
  const listed = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) {
    throw listed.error
  }

  return listed.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function ensureReward(adminClient, fournisseurId, payload) {
  const existing = await adminClient
    .from('reward_rules')
    .select('id, description, points_required, emoji, actif')
    .eq('fournisseur_id', fournisseurId)
    .eq('nom', payload.nom)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  if (existing.data?.id) {
    const needsUpdate =
      existing.data.description !== payload.description ||
      Number(existing.data.points_required) !== Number(payload.points_required) ||
      existing.data.emoji !== payload.emoji ||
      Boolean(existing.data.actif) !== Boolean(payload.actif)

    if (!needsUpdate) {
      return { id: existing.data.id, created: false, updated: false }
    }

    const updated = await adminClient
      .from('reward_rules')
      .update({
        description: payload.description,
        points_required: payload.points_required,
        emoji: payload.emoji,
        actif: payload.actif,
      })
      .eq('id', existing.data.id)

    if (updated.error) {
      throw updated.error
    }

    return { id: existing.data.id, created: false, updated: true }
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

  return { id: inserted.data.id, created: true, updated: false }
}

async function cleanupObsoleteRewards(adminClient, fournisseurId, allowedNames) {
  const listed = await adminClient
    .from('reward_rules')
    .select('id, nom')
    .eq('fournisseur_id', fournisseurId)

  if (listed.error) {
    throw listed.error
  }

  const allowed = new Set(allowedNames)
  const obsolete = (listed.data ?? []).filter((row) => !allowed.has(row.nom))

  if (obsolete.length === 0) {
    return { deleted: 0, deletedNames: [] }
  }

  const obsoleteIds = obsolete.map((row) => row.id)
  const removed = await adminClient.from('reward_rules').delete().in('id', obsoleteIds)

  if (removed.error) {
    throw removed.error
  }

  return {
    deleted: obsolete.length,
    deletedNames: obsolete.map((row) => row.nom),
  }
}

async function seedForProvider(adminClient, providerEmail, rewards) {
  const user = await findUserByEmail(adminClient, providerEmail)
  if (!user?.id) {
    throw new Error(`User not found: ${providerEmail}`)
  }

  const providerRow = await adminClient
    .from('fournisseurs')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (providerRow.error || !providerRow.data?.id) {
    throw providerRow.error ?? new Error(`Fournisseur row not found for: ${providerEmail}`)
  }

  const fournisseurId = providerRow.data.id
  let createdCount = 0
  let updatedCount = 0

  for (const reward of rewards) {
    const result = await ensureReward(adminClient, fournisseurId, reward)
    if (result.created) {
      createdCount += 1
    }
    if (result.updated) {
      updatedCount += 1
    }
  }

  const cleanup = await cleanupObsoleteRewards(
    adminClient,
    fournisseurId,
    rewards.map((reward) => reward.nom),
  )

  return {
    providerEmail,
    fournisseurId,
    total: rewards.length,
    created: createdCount,
    updated: updatedCount,
    unchanged: rewards.length - createdCount - updatedCount,
    deleted: cleanup.deleted,
    deletedNames: cleanup.deletedNames,
  }
}

async function main() {
  const envRaw = execSync('npx supabase status -o env', {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const supabaseUrl = parseEnvValue(envRaw, 'API_URL')
  const serviceRoleKey = parseEnvValue(envRaw, 'SERVICE_ROLE_KEY').replace(/\s+/g, '')
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const provider1Rewards = [
    {
      nom: 'Mini espresso offert',
      description: 'Un mini espresso offert',
      points_required: 50,
      emoji: '☕',
      actif: true,
    },
    {
      nom: 'Boisson chaude offerte',
      description: 'Une boisson chaude offerte au choix',
      points_required: 100,
      emoji: '🥤',
      actif: true,
    },
    {
      nom: 'Dessert maison offert',
      description: 'Un dessert maison offert',
      points_required: 200,
      emoji: '🍰',
      actif: true,
    },
    {
      nom: 'Menu midi -20%',
      description: 'Reduction de 20% sur le menu midi',
      points_required: 400,
      emoji: '🍽️',
      actif: true,
    },
  ]

  const provider2Rewards = [
    {
      nom: 'Mini soin express',
      description: 'Soin express de 10 minutes',
      points_required: 50,
      emoji: '🫧',
      actif: true,
    },
    {
      nom: 'Shampoing premium offert',
      description: 'Un shampoing premium format voyage offert',
      points_required: 100,
      emoji: '🧴',
      actif: true,
    },
    {
      nom: 'Brushing -30%',
      description: 'Reduction de 30% sur un brushing',
      points_required: 200,
      emoji: '💇',
      actif: true,
    },
    {
      nom: 'Soin capillaire offert',
      description: 'Soin capillaire complet offert',
      points_required: 400,
      emoji: '✨',
      actif: true,
    },
  ]

  const [provider1Summary, provider2Summary] = await Promise.all([
    seedForProvider(adminClient, 'provider1@loyalup.test', provider1Rewards),
    seedForProvider(adminClient, 'provider2@loyalup.test', provider2Rewards),
  ])

  console.log('Reward examples seeded successfully')
  console.log(provider1Summary)
  console.log(provider2Summary)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
