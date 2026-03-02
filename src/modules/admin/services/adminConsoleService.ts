import { supabase } from '../../../shared/lib/supabaseClient'

export type AdminOverview = {
  providers: number
  clients: number
  admins: number
  total_users: number
  transactions: number
  api_errors: number
  failed_webhook_deliveries: number
}

export type AdminUserRow = {
  id: string
  email: string
  role: 'client' | 'fournisseur' | 'admin'
  nom: string
  provider_tier: 'free' | 'starter' | 'premium' | 'enterprise' | null
  blocked: boolean
  created_at: string
  last_sign_in_at: string | null
}

export type ApiUsageRow = {
  id: string
  api_key_id: string
  endpoint: string
  method: string
  status_code: number | null
  response_time_ms: number | null
  ip_address: string | null
  created_at: string
}

export type WebhookFailureRow = {
  id: string
  webhook_id: string
  event_type: string
  payload: Record<string, unknown>
  response_status: number | null
  response_body: string | null
  duration_ms: number | null
  attempt_number: number
  success: boolean
  delivered_at: string
}

export type AdminAuditLogRow = {
  id: string
  admin_user_id: string
  action: string
  target_user_id: string | null
  success: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export type ScanAdRow = {
  id: string
  title: string
  body: string
  cta_label: string | null
  cta_url: string | null
  active: boolean
  display_order: number
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

export async function getAdminOverview() {
  const data = await invoke<{ overview: AdminOverview }>({ action: 'GET_OVERVIEW' })
  return data.overview
}

export async function listAdminUsers(params?: { page?: number; limit?: number; search?: string }) {
  const data = await invoke<{ users: AdminUserRow[] }>(
    {
      action: 'LIST_USERS',
      page: params?.page ?? 1,
      limit: params?.limit ?? 25,
      search: params?.search ?? '',
    },
  )

  return data.users ?? []
}

export async function updateAdminUserRole(userId: string, role: 'client' | 'fournisseur' | 'admin') {
  return invoke({
    action: 'UPDATE_USER_ROLE',
    user_id: userId,
    role,
  })
}

export async function toggleAdminUserBlock(userId: string, blocked: boolean) {
  return invoke({
    action: 'TOGGLE_USER_BLOCK',
    user_id: userId,
    blocked,
  })
}

export async function updateAdminProviderTier(
  userId: string,
  tier: 'free' | 'starter' | 'premium' | 'enterprise',
) {
  return invoke({
    action: 'UPDATE_PROVIDER_TIER',
    user_id: userId,
    tier,
  })
}

export async function bulkUpdateAdminUsers(params: {
  user_ids: string[]
  role?: 'client' | 'fournisseur' | 'admin'
  blocked?: boolean
}) {
  return invoke({
    action: 'BULK_UPDATE_USERS',
    user_ids: params.user_ids,
    role: params.role,
    blocked: params.blocked,
  })
}

export async function bulkImportAdminUsers(rows: Array<Record<string, unknown>>) {
  return invoke<{
    success: boolean
    summary: { total: number; succeeded: number; failed: number }
    results: Array<{ row: number; user_id: string | null; ok: boolean; error?: string }>
  }>({
    action: 'BULK_IMPORT_USERS',
    rows,
  })
}

export async function impersonateAdminUser(userId: string) {
  const data = await invoke<{ impersonation_url: string | null }>({
    action: 'IMPERSONATE_USER',
    user_id: userId,
  })

  return data.impersonation_url
}

export async function getAdminApiUsage(limit = 200) {
  const data = await invoke<{ usage: ApiUsageRow[] }>({ action: 'GET_API_USAGE', limit })
  return data.usage ?? []
}

export async function getAdminWebhookFailures(limit = 100) {
  const data = await invoke<{ failures: WebhookFailureRow[] }>({ action: 'GET_WEBHOOK_FAILURES', limit })
  return data.failures ?? []
}

export async function retryAdminWebhookDelivery(deliveryId: string) {
  return invoke({ action: 'RETRY_WEBHOOK_DELIVERY', delivery_id: deliveryId })
}

export async function getAdminAuditLogs(limit = 100) {
  const data = await invoke<{ logs: AdminAuditLogRow[] }>({ action: 'GET_AUDIT_LOGS', limit })
  return data.logs ?? []
}

export async function listScanAds() {
  const data = await invoke<{ ads: ScanAdRow[] }>({ action: 'LIST_SCAN_ADS' })
  return data.ads ?? []
}

export async function upsertScanAd(payload: {
  id?: string
  title: string
  body: string
  cta_label?: string | null
  cta_url?: string | null
  active: boolean
  display_order: number
  starts_at?: string | null
  ends_at?: string | null
}) {
  const data = await invoke<{ ad: ScanAdRow | null }>({
    action: 'UPSERT_SCAN_AD',
    ...payload,
  })

  return data.ad
}

export async function deleteScanAd(id: string) {
  return invoke({ action: 'DELETE_SCAN_AD', id })
}

async function invoke<TData = Record<string, unknown>>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-console', {
    method: 'POST',
    body,
  })

  if (error) {
    throw error
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid admin console response')
  }

  if ('error' in data && typeof data.error === 'string') {
    throw new Error(data.error)
  }

  return data as TData
}
