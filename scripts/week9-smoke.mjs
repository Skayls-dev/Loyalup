import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadEnvLocal() {
  const envPath = path.resolve('.env.local')
  const content = fs.readFileSync(envPath, 'utf8')
  const entries = Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        const key = line.slice(0, index)
        const value = line.slice(index + 1)
        return [key, value]
      }),
  )

  return {
    url: entries.VITE_SUPABASE_URL,
    anonKey: entries.VITE_SUPABASE_ANON_KEY,
  }
}

async function main() {
  const env = loadEnvLocal()
  if (!env.url || !env.anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  }

  // Also load .env.functions.local for validation
  let functionEnv = {}
  try {
    const functionEnvPath = path.resolve('.env.functions.local')
    if (fs.existsSync(functionEnvPath)) {
      const content = fs.readFileSync(functionEnvPath, 'utf8')
      functionEnv = Object.fromEntries(
        content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#') && line.includes('='))
          .map((line) => {
            const index = line.indexOf('=')
            const key = line.slice(0, index)
            const value = line.slice(index + 1)
            return [key, value]
          }),
      )
    }
  } catch {
    console.warn('[WARN] Could not load .env.functions.local')
  }

  if (!functionEnv.API_KEY_PEPPER) {
    console.warn('[WARN] API_KEY_PEPPER not in .env.functions.local; functions may fail')
    console.warn('[HINT] Ensure supabase functions serve is running with: supabase functions serve --env-file .env.functions.local')
  }

  const supabase = createClient(env.url, env.anonKey)

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'provider1@loyalup.test',
    password: 'Test1234!',
  })

  if (signInError || !signInData.session?.access_token) {
    throw new Error(`Provider login failed: ${signInError?.message ?? 'unknown'}`)
  }

  const providerToken = signInData.session.access_token

  const invoke = async (name, body) => {
    const response = await fetch(`${env.url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(`${name} failed (${response.status}): ${JSON.stringify(data)}`)
    }

    return data
  }

  let createdKey
  try {
    createdKey = await invoke('manage-api-keys', {
      action: 'CREATE',
      name: `smoke-${Date.now()}`,
      environment: 'production',
      scopes: ['read', 'write', 'transactions', 'clients'],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    
    // Check if it's the missing pepper env var error
    if (message.includes('API_KEY_PEPPER') && !functionEnv.API_KEY_PEPPER) {
      console.error('[ERROR] API_KEY_PEPPER not found in .env.functions.local')
      console.error('[HINT] Ensure .env.functions.local exists with API_KEY_PEPPER=<value>')
      console.error('[HINT] Then restart: supabase functions serve --env-file .env.functions.local')
      throw error
    }
    
    if (!message.includes('max 1 API keys')) {
      throw error
    }

    const listed = await invoke('manage-api-keys', { action: 'LIST' })
    const keyId = listed.keys?.[0]?.id
    if (!keyId) {
      throw new Error('Tier key limit reached and no key available to rotate')
    }

    await invoke('manage-api-keys', {
      action: 'REVOKE',
      key_id: keyId,
    })

    createdKey = await invoke('manage-api-keys', {
      action: 'CREATE',
      name: `smoke-recreated-${Date.now()}`,
      environment: 'production',
      scopes: ['read', 'write', 'transactions', 'clients'],
    })
  }

  const apiKey = createdKey.key
  if (!apiKey) {
    throw new Error('manage-api-keys CREATE did not return key')
  }

  const callApi = async (functionName, init = {}) => {
    const response = await fetch(`${env.url}/functions/v1/${functionName}`, {
      ...init,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.success === false) {
      throw new Error(`${functionName} failed (${response.status}): ${JSON.stringify(payload)}`)
    }

    return payload
  }

  const sandboxStatus = await callApi('api-v1-sandbox?mode=status')
  const stats = await callApi('api-v1-stats')
  const services = await callApi('api-v1-services')
  const promotions = await callApi('api-v1-promotions')

  const whiteLabel = await invoke('manage-white-label', {
    action: 'UPSERT',
    payload: {
      brand_name: 'LoyalUp Smoke Brand',
      primary_color: '#18181b',
      secondary_color: '#3f3f46',
      accent_color: '#fafafa',
      custom_domain: 'smoke.local.loyalup.test',
      hide_loyalup_branding: false,
    },
  })

  let webhook = null
  let webhookDeniedByTier = false
  try {
    webhook = await invoke('manage-webhooks', {
      action: 'CREATE',
      url: 'https://example.com/webhooks/loyalup-smoke',
      events: ['transaction.validated', 'promotion.created'],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('max 0 active webhooks')) {
      webhookDeniedByTier = true
    } else {
      throw error
    }
  }

  let apiKeys = { keys: [] }
  let webhooks = { webhooks: [] }

  try {
    apiKeys = await invoke('manage-api-keys', { action: 'LIST' })
  } catch {
    apiKeys = { keys: [] }
  }

  try {
    webhooks = await invoke('manage-webhooks', { action: 'LIST' })
  } catch {
    webhooks = { webhooks: [] }
  }

  console.log('Week9 smoke OK')
  console.log(
    JSON.stringify(
      {
        provider_id: sandboxStatus.data?.provider_id ?? null,
        api_key_prefix: createdKey.metadata?.key_prefix ?? null,
        stats_summary: stats.data,
        services_count: Array.isArray(services.data) ? services.data.length : 0,
        promotions_count: Array.isArray(promotions.data) ? promotions.data.length : 0,
        white_label_configured: Boolean(whiteLabel.config?.brand_name),
        webhook_created: Boolean(webhook?.webhook?.id),
        webhook_denied_by_tier: webhookDeniedByTier,
        total_api_keys: Array.isArray(apiKeys.keys) ? apiKeys.keys.length : 0,
        total_webhooks: Array.isArray(webhooks.webhooks) ? webhooks.webhooks.length : 0,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
