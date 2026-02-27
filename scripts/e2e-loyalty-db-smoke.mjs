import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

function parseEnvValue(raw, key) {
  const match = raw.match(new RegExp(`${key}="([^"]+)"`))
  if (!match?.[1]) {
    throw new Error(`Missing ${key} in supabase status output`)
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
  const envRaw = execSync('npx supabase status -o env', {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const supabaseUrl = parseEnvValue(envRaw, 'API_URL')
  const serviceRoleKey = parseEnvValue(envRaw, 'SERVICE_ROLE_KEY')

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const providerUser = await ensureUser(adminClient, {
    email: 'provider1@loyalup.test',
    password: 'Test1234!',
    role: 'fournisseur',
    nom: 'Provider 1',
  })

  const clientUser = await ensureUser(adminClient, {
    email: 'client1@loyalup.test',
    password: 'Test1234!',
    role: 'client',
    nom: 'Client 1',
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
      nom: `Récompense DB smoke ${randomSuffix()}`,
      description: 'Récompense de test DB',
      points_required: 5,
      emoji: '🎁',
      actif: true,
    })
    .select('id, points_required')
    .single()

  if (rewardInsert.error || !rewardInsert.data?.id) {
    throw rewardInsert.error ?? new Error('Failed to create reward rule')
  }

  const qrTokenInsert = await adminClient
    .from('qr_tokens')
    .insert({
      fournisseur_id: providerId,
      token: crypto.randomUUID(),
      status: 'active',
      expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (qrTokenInsert.error || !qrTokenInsert.data?.id) {
    throw qrTokenInsert.error ?? new Error('Failed to create qr token')
  }

  const pendingInsert = await adminClient
    .from('pending_transactions')
    .insert({
      qr_token_id: qrTokenInsert.data.id,
      client_id: clientUser.id,
      fournisseur_id: providerId,
      status: 'pending',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (pendingInsert.error || !pendingInsert.data?.id) {
    throw pendingInsert.error ?? new Error('Failed to create pending transaction')
  }

  const creditResult = await adminClient.rpc('credit_points_transaction', {
    p_provider_user_id: providerUser.id,
    p_pending_transaction_id: pendingInsert.data.id,
    p_montant: 1,
    p_service_id: null,
  })

  if (creditResult.error) {
    throw creditResult.error
  }

  const creditData = Array.isArray(creditResult.data) ? creditResult.data[0] : null
  if (!creditData?.success) {
    throw new Error('credit_points_transaction returned unsuccessful result')
  }

  const unlockCheck = await adminClient.rpc('check_and_unlock_rewards', {
    p_client_id: clientUser.id,
    p_fournisseur_id: providerId,
  })

  if (unlockCheck.error) {
    throw unlockCheck.error
  }

  const unlockedRewardQuery = await adminClient
    .from('client_rewards')
    .select('id, status, reward_rule_id')
    .eq('client_id', clientUser.id)
    .eq('fournisseur_id', providerId)
    .eq('reward_rule_id', rewardInsert.data.id)
    .single()

  if (unlockedRewardQuery.error || !unlockedRewardQuery.data?.id) {
    throw unlockedRewardQuery.error ?? new Error('Reward not unlocked after check_and_unlock_rewards')
  }

  const consumeResult = await adminClient.rpc('consume_client_reward', {
    p_client_reward_id: unlockedRewardQuery.data.id,
    p_client_id: clientUser.id,
  })

  if (consumeResult.error) {
    throw consumeResult.error
  }

  const consumeData = Array.isArray(consumeResult.data) ? consumeResult.data[0] : null
  if (!consumeData?.success) {
    throw new Error('consume_client_reward returned unsuccessful result')
  }

  const rewardAfterUse = await adminClient
    .from('client_rewards')
    .select('status, used_at')
    .eq('id', unlockedRewardQuery.data.id)
    .single()

  if (rewardAfterUse.error || rewardAfterUse.data.status !== 'used' || !rewardAfterUse.data.used_at) {
    throw rewardAfterUse.error ?? new Error('Reward was not marked as used')
  }

  const finalBalance = await adminClient
    .from('client_points')
    .select('solde')
    .eq('client_id', clientUser.id)
    .eq('fournisseur_id', providerId)
    .single()

  if (finalBalance.error) {
    throw finalBalance.error
  }

  console.log('✅ DB/RPC loyalty smoke test passed')
  console.log(
    JSON.stringify(
      {
        provider_id: providerId,
        client_id: clientUser.id,
        pending_transaction_id: pendingInsert.data.id,
        reward_rule_id: rewardInsert.data.id,
        points_credited: creditData.points_credited,
        points_deducted: consumeData.points_deducted,
        final_balance: finalBalance.data.solde,
        reward_status: rewardAfterUse.data.status,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error('❌ DB/RPC loyalty smoke test failed')
  console.error(error)
  process.exit(1)
})
