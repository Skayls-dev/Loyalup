export type ProviderIntegrationProvider = 'sumup'
export type ProviderIntegrationStatus = 'active' | 'revoked' | 'expired'

export type ProviderIntegration = {
  id: string
  fournisseur_id: string
  provider: ProviderIntegrationProvider
  status: ProviderIntegrationStatus
  access_token: string
  refresh_token: string | null
  expires_at: string
  sumup_merchant_code: string | null
  sumup_merchant_name: string | null
  scopes: string[] | null
  created_at: string
  updated_at: string
}

export type ProviderIntegrationInsert = {
  id?: string
  fournisseur_id: string
  provider?: ProviderIntegrationProvider
  status?: ProviderIntegrationStatus
  access_token: string
  refresh_token?: string | null
  expires_at: string
  sumup_merchant_code?: string | null
  sumup_merchant_name?: string | null
  scopes?: string[]
  created_at?: string
  updated_at?: string
}

export type SumUpConnectionStatus = 'connected' | 'disconnected' | 'expired' | 'error'
