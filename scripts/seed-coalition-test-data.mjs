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

async function getProviderIdByUserId(adminClient, userId) {
  const { data, error } = await adminClient
    .from('fournisseurs')
    .select('id, nom_commerce')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(`Missing fournisseur row for user ${userId}`)
  }

  return data
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

  const provider1User = await findUserByEmail(adminClient, 'provider1@loyalup.test')
  const provider2User = await findUserByEmail(adminClient, 'provider2@loyalup.test')

  if (!provider1User?.id || !provider2User?.id) {
    throw new Error('provider1/provider2 users are required. Run create-test-users first.')
  }

  const provider1 = await getProviderIdByUserId(adminClient, provider1User.id)
  const provider2 = await getProviderIdByUserId(adminClient, provider2User.id)

  const coalitionName = 'Coalition Demo Local'

  let coalitionId = null
  const { data: existingCoalition, error: coalitionLookupError } = await adminClient
    .from('provider_coalitions')
    .select('id, name')
    .eq('name', coalitionName)
    .maybeSingle()

  if (coalitionLookupError) {
    throw coalitionLookupError
  }

  if (existingCoalition?.id) {
    coalitionId = existingCoalition.id
  } else {
    const { data: insertedCoalition, error: coalitionInsertError } = await adminClient
      .from('provider_coalitions')
      .insert({
        name: coalitionName,
        description: 'Coalition locale de démonstration pour tester le transfert de points',
        logo_url: null,
        conversion_rate: 1,
        platform_fee_pct: 0.05,
        is_active: true,
        created_by: provider1.id,
      })
      .select('id')
      .single()

    if (coalitionInsertError || !insertedCoalition?.id) {
      throw coalitionInsertError ?? new Error('Failed to create coalition')
    }

    coalitionId = insertedCoalition.id
  }

  const members = [provider1.id, provider2.id]

  for (const fournisseurId of members) {
    const { error } = await adminClient
      .from('coalition_members')
      .upsert(
        {
          coalition_id: coalitionId,
          fournisseur_id: fournisseurId,
          joined_at: new Date().toISOString(),
          status: 'active',
        },
        { onConflict: 'coalition_id,fournisseur_id' },
      )

    if (error) {
      throw error
    }
  }

  console.log('Coalition seed complete')
  console.log(`coalition_id=${coalitionId}`)
  console.log(`member_1=${provider1.nom_commerce} (${provider1.id})`)
  console.log(`member_2=${provider2.nom_commerce} (${provider2.id})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
