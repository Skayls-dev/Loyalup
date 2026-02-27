import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

function parseEnvValue(raw, key) {
  const match = raw.match(new RegExp(`${key}="([^"]+)"`))
  if (!match?.[1]) {
    throw new Error(`Missing ${key} in supabase status output`)
  }

  const value = match[1]

  if (key.includes('KEY')) {
    return value.replace(/\s+/g, '')
  }

  return value.trim()
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 7)
}

async function callFunction({ supabaseUrl, anonKey, functionName, token, body }) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  })

  const text = await response.text()
  let json = null

  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  if (!response.ok) {
    throw new Error(`${functionName} failed (${response.status}): ${JSON.stringify(json)}`)
  }

  return json
}

async function ensureUser(adminClient, { email, password, role, nom }) {
  const createResult = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, nom },
  })

  const createError = createResult.error
  if (createError && !createError.message.toLowerCase().includes('already')) {
    throw createError
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

  return { id: user.id, email, password, role }
}

async function main() {
  const envRaw = execSync('npx supabase status -o env', {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const supabaseUrl = parseEnvValue(envRaw, 'API_URL')
  const anonKey = parseEnvValue(envRaw, 'ANON_KEY')
  const serviceRoleKey = parseEnvValue(envRaw, 'SERVICE_ROLE_KEY')

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const providerUser = await ensureUser(adminClient, {
    email: 'provider1@loyalup.test',
    password: 'Test1234!',
    role: 'fournisseur',
    nom: 'Provider 1',
  })

  const smokeSuffix = randomSuffix()

  const clientUser = await ensureUser(adminClient, {
    email: `client-smoke-${smokeSuffix}@loyalup.test`,
    password: 'Test1234!',
    role: 'client',
    nom: `Client Smoke ${smokeSuffix}`,
  })

  const { data: providerRow, error: providerRowError } = await adminClient
    .from('fournisseurs')
    .select('id')
    .eq('user_id', providerUser.id)
    .single()

  if (providerRowError || !providerRow?.id) {
    throw providerRowError ?? new Error('Provider row not found')
  }

  const providerId = providerRow.id

  const rewardInsert = await adminClient
    .from('reward_rules')
    .insert({
      fournisseur_id: providerId,
      nom: `Récompense smoke ${randomSuffix()}`,
      description: 'Récompense de test automatique',
      points_required: 5,
      emoji: '🎁',
      actif: true,
    })
    .select('id, points_required, nom')
    .single()

  if (rewardInsert.error || !rewardInsert.data?.id) {
    throw rewardInsert.error ?? new Error('Failed to insert reward rule')
  }

  const rewardRule = rewardInsert.data

  const providerClient = createClient(supabaseUrl, anonKey)
  const clientClient = createClient(supabaseUrl, anonKey)

  const providerSignIn = await providerClient.auth.signInWithPassword({
    email: providerUser.email,
    password: providerUser.password,
  })

  if (providerSignIn.error || !providerSignIn.data.session) {
    throw providerSignIn.error ?? new Error('Provider sign in failed')
  }

  const providerToken = providerSignIn.data.session.access_token
  const providerTokenValidation = await providerClient.auth.getUser(providerToken)
  if (providerTokenValidation.error || !providerTokenValidation.data.user?.id) {
    throw providerTokenValidation.error ?? new Error('Provider token validation failed')
  }

  const clientSignIn = await clientClient.auth.signInWithPassword({
    email: clientUser.email,
    password: clientUser.password,
  })

  if (clientSignIn.error || !clientSignIn.data.session) {
    throw clientSignIn.error ?? new Error('Client sign in failed')
  }

  const clientToken = clientSignIn.data.session.access_token
  const clientTokenValidation = await clientClient.auth.getUser(clientToken)
  if (clientTokenValidation.error || !clientTokenValidation.data.user?.id) {
    throw clientTokenValidation.error ?? new Error('Client token validation failed')
  }

  const qrResult = await callFunction({
    supabaseUrl,
    anonKey,
    functionName: 'generate-qr',
    token: providerToken,
  })

  if (!qrResult?.token) {
    throw new Error('generate-qr failed: missing token')
  }

  const validateResult = await callFunction({
    supabaseUrl,
    anonKey,
    functionName: 'validate-qr',
    token: clientToken,
    body: { token: qrResult.token },
  })

  if (!validateResult?.transaction_id) {
    throw new Error('validate-qr failed: missing transaction_id')
  }

  const pendingTransactionId = validateResult.transaction_id

  const creditResult = await callFunction({
    supabaseUrl,
    anonKey,
    functionName: 'credit-points',
    token: providerToken,
    body: {
      pending_transaction_id: pendingTransactionId,
      montant: 1,
    },
  })

  if (!creditResult?.success) {
    throw new Error('credit-points failed')
  }

  const unlockedRewardQuery = await adminClient
    .from('client_rewards')
    .select('id, status, reward_rule_id')
    .eq('client_id', clientUser.id)
    .eq('fournisseur_id', providerId)
    .eq('reward_rule_id', rewardRule.id)
    .maybeSingle()

  if (unlockedRewardQuery.error || !unlockedRewardQuery.data?.id) {
    throw unlockedRewardQuery.error ?? new Error('Reward was not unlocked after credit')
  }

  if (unlockedRewardQuery.data.status !== 'available') {
    throw new Error(`Unexpected unlocked reward status: ${unlockedRewardQuery.data.status}`)
  }

  const useRewardResult = await callFunction({
    supabaseUrl,
    anonKey,
    functionName: 'unlock-reward',
    token: clientToken,
    body: { client_reward_id: unlockedRewardQuery.data.id },
  })

  if (!useRewardResult?.success) {
    throw new Error('unlock-reward failed')
  }

  const balanceQuery = await adminClient
    .from('client_points')
    .select('solde')
    .eq('client_id', clientUser.id)
    .eq('fournisseur_id', providerId)
    .single()

  if (balanceQuery.error || typeof balanceQuery.data?.solde !== 'number') {
    throw balanceQuery.error ?? new Error('Unable to read final points balance')
  }

  const rewardAfterUse = await adminClient
    .from('client_rewards')
    .select('status, used_at')
    .eq('id', unlockedRewardQuery.data.id)
    .single()

  if (rewardAfterUse.error) {
    throw rewardAfterUse.error
  }

  console.log('✅ E2E smoke test passed')
  console.log(
    JSON.stringify(
      {
        provider_id: providerId,
        client_id: clientUser.id,
        pending_transaction_id: pendingTransactionId,
        reward_rule_id: rewardRule.id,
        points_credited: creditResult.points_credited,
        points_deducted: useRewardResult.points_deducted,
        final_balance: balanceQuery.data.solde,
        reward_status: rewardAfterUse.data.status,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error('❌ E2E smoke test failed')
  console.error(error)
  process.exit(1)
})
