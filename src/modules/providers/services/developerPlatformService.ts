import { supabase } from '../../../shared/lib/supabaseClient'

export type ProviderApiKey = {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  environment: 'sandbox' | 'production'
  is_active: boolean
  expires_at: string | null
  last_used_at: string | null
  created_at: string
}

export type ProviderWebhook = {
  id: string
  url: string
  events: string[]
  is_active: boolean
  failure_count: number
  last_triggered_at: string | null
  last_success_at: string | null
  created_at: string
}

export type WhiteLabelConfig = {
  id: string
  fournisseur_id: string
  brand_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  font_family: string
  custom_domain: string | null
  domain_verified: boolean
  domain_verified_at: string | null
  verification_token: string | null
  hide_loyalup_branding: boolean
  custom_terms_url: string | null
  custom_privacy_url: string | null
  from_email: string | null
  from_name: string | null
  email_header_color: string | null
  created_at: string
  updated_at: string
}

export async function listApiKeys() {
  const data = await invokeFunction<{ keys: ProviderApiKey[] }>('manage-api-keys', {
    action: 'LIST',
  })

  return data.keys ?? []
}

export async function createApiKey(params: {
  name: string
  environment: 'sandbox' | 'production'
  scopes: string[]
}) {
  return invokeFunction<{
    key: string
    key_once: boolean
    metadata: ProviderApiKey
  }>('manage-api-keys', {
    action: 'CREATE',
    name: params.name,
    environment: params.environment,
    scopes: params.scopes,
  })
}

export async function revokeApiKey(keyId: string) {
  return invokeFunction<{ revoked: boolean }>('manage-api-keys', {
    action: 'REVOKE',
    key_id: keyId,
  })
}

export async function rotateApiKey(keyId: string, name?: string) {
  return invokeFunction<{
    key: string
    key_once: boolean
    metadata: ProviderApiKey
  }>('manage-api-keys', {
    action: 'ROTATE',
    key_id: keyId,
    name,
  })
}

export async function listWebhooks() {
  const data = await invokeFunction<{ webhooks: ProviderWebhook[] }>('manage-webhooks', {
    action: 'LIST',
  })

  return data.webhooks ?? []
}

export async function createWebhook(url: string, events: string[]) {
  const data = await invokeFunction<{ webhook: ProviderWebhook }>('manage-webhooks', {
    action: 'CREATE',
    url,
    events,
  })

  return data.webhook
}

export async function updateWebhook(
  webhookId: string,
  updates: { url?: string; events?: string[]; is_active?: boolean },
) {
  const data = await invokeFunction<{ webhook: ProviderWebhook }>('manage-webhooks', {
    action: 'UPDATE',
    webhook_id: webhookId,
    ...updates,
  })

  return data.webhook
}

export async function deleteWebhook(webhookId: string) {
  return invokeFunction<{ deleted: boolean }>('manage-webhooks', {
    action: 'DELETE',
    webhook_id: webhookId,
  })
}

export async function rotateWebhookSecret(webhookId: string) {
  return invokeFunction<{ webhook_id: string; secret: string; secret_once: true }>('manage-webhooks', {
    action: 'ROTATE_SECRET',
    webhook_id: webhookId,
  })
}

export async function getWhiteLabelConfig() {
  const data = await invokeFunction<{ config: WhiteLabelConfig | null }>('manage-white-label', {
    action: 'GET',
  })

  return data.config
}

export async function upsertWhiteLabelConfig(
  payload: Omit<
    WhiteLabelConfig,
    'id' | 'fournisseur_id' | 'domain_verified' | 'domain_verified_at' | 'verification_token' | 'created_at' | 'updated_at'
  >,
) {
  const data = await invokeFunction<{ config: WhiteLabelConfig }>('manage-white-label', {
    action: 'UPSERT',
    payload,
  })

  return data.config
}

export async function verifyWhiteLabelDomain(customDomain: string, verificationToken: string) {
  return invokeFunction<{ verified: boolean }>('manage-white-label', {
    action: 'VERIFY_DOMAIN',
    custom_domain: customDomain,
    verification_token: verificationToken,
  })
}

async function invokeFunction<TData>(name: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, {
    method: 'POST',
    body,
  })

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Empty function response')
  }

  if (typeof data === 'object' && data && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error)
  }

  return data as TData
}
