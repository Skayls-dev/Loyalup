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

async function findUserByEmail(adminClient, email) {
  const listed = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) {
    throw listed.error
  }

  return listed.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function ensureUser(adminClient, { email, password, role, nom, adresse = 'N/A', latitude = null, longitude = null }) {
  const created = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, nom },
  })

  if (created.error && !created.error.message.toLowerCase().includes('already')) {
    throw created.error
  }

  let user = created.data.user
  if (!user) {
    user = await findUserByEmail(adminClient, email)
  }

  if (!user?.id) {
    throw new Error(`Unable to resolve user for ${email}`)
  }

  const updated = await adminClient.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { role, nom },
  })

  if (updated.error) {
    throw updated.error
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
        adresse,
        latitude,
        longitude,
      },
      { onConflict: 'user_id' },
    )

    if (providerError) {
      throw providerError
    }
  }

  return {
    id: user.id,
    email,
    role,
  }
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = resolveAdminCredentials()
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const users = [
    { email: 'client1@loyalup.test', password: 'Test1234!', role: 'client', nom: 'Client 1' },
    { email: 'client2@loyalup.test', password: 'Test1234!', role: 'client', nom: 'Client 2' },
    {
      email: 'provider1@loyalup.test',
      password: 'Test1234!',
      role: 'fournisseur',
      nom: 'Provider 1',
      adresse: 'Bruxelles, Belgique',
      latitude: 50.8503,
      longitude: 4.3517,
    },
    {
      email: 'provider2@loyalup.test',
      password: 'Test1234!',
      role: 'fournisseur',
      nom: 'Provider 2',
      adresse: 'Liège, Belgique',
      latitude: 50.6326,
      longitude: 5.5797,
    },
    { email: 'admin1@loyalup.test', password: 'Test1234!', role: 'admin', nom: 'Platform Owner 1' },
  ]

  const created = []
  for (const user of users) {
    created.push(await ensureUser(adminClient, user))
  }

  for (const row of created) {
    console.log(`${row.email}\t${row.role}\t${row.id}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
