import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
}

const adminClient = createClient(supabaseUrl, serviceRoleKey)

async function findUserByEmail(email) {
  const listed = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) throw listed.error

  return listed.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function ensureUser({
  email,
  password,
  role,
  nom,
  adresse = 'N/A',
  latitude = null,
  longitude = null,
  superAdmin = false,
}) {
  const userMetadata = { role, nom, ...(superAdmin ? { super_admin: true } : {}) }

  const created = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  })

  if (created.error && !created.error.message.toLowerCase().includes('already')) {
    throw created.error
  }

  let user = created.data.user
  if (!user) {
    user = await findUserByEmail(email)
  }

  if (!user?.id) {
    throw new Error(`Unable to resolve user for ${email}`)
  }

  const updated = await adminClient.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: userMetadata,
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
    superAdmin,
  }
}

async function main() {
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
    {
      email: 'superadmin@loyalup.test',
      password: 'SuperAdmin123!',
      role: 'admin',
      nom: 'Super Admin',
      superAdmin: true,
    },
  ]

  const created = []
  for (const user of users) {
    created.push(await ensureUser(user))
  }

  for (const row of created) {
    const marker = row.superAdmin ? ' (super_admin)' : ''
    console.log(`${row.email}\t${row.role}${marker}\t${row.id}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
