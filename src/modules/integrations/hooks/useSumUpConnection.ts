import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/lib/supabaseClient'
import { config } from '../../../shared/lib/env'
import type { SumUpConnectionStatus } from '../../../shared/types/integrations'

type IntegrationRow = {
  id: string
  fournisseur_id: string
  status: string
  sumup_merchant_code: string | null
  sumup_merchant_name: string | null
  created_at: string
  expires_at: string
}

type UseSumUpConnectionResult = {
  connectionStatus: SumUpConnectionStatus
  merchantName: string | null
  merchantCode: string | null
  connectedAt: Date | null
  isLoading: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

function deriveStatus(row: IntegrationRow | null | undefined): SumUpConnectionStatus {
  if (!row) return 'disconnected'
  if (row.status === 'revoked') return 'disconnected'
  if (row.status === 'expired') return 'expired'
  if (new Date(row.expires_at) < new Date()) return 'expired'
  if (row.status === 'active') return 'connected'
  return 'error'
}

// userId = auth.uid() (the value available in MerchantSettingsPage as user?.id)
// We resolve fournisseur_id automatically via the fournisseurs table.
async function fetchIntegrationByUserId(userId: string): Promise<IntegrationRow | null> {
  // 1. Resolve fournisseur.id from user_id
  const { data: fournisseur, error: fErr } = await supabase
    .from('fournisseurs')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>()

  if (fErr || !fournisseur?.id) return null

  // 2. Fetch integration row
  const { data, error } = await supabase
    .from('provider_integrations')
    .select('id, fournisseur_id, status, sumup_merchant_code, sumup_merchant_name, created_at, expires_at')
    .eq('fournisseur_id', fournisseur.id)
    .eq('provider', 'sumup')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as IntegrationRow | null
}

// Decode JWT exp claim to check if it has already expired.
function isJwtExpired(token: string): boolean {
  try {
    const [, b64] = token.split('.')
    const { exp } = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return typeof exp === 'number' && exp * 1000 < Date.now()
  } catch {
    return true // treat unparseable tokens as expired
  }
}

// Always obtain a server-fresh token by calling refreshSession().
// getSession() only reads localStorage and can return stale/invalidated tokens.
async function getAccessTokenOrThrow(): Promise<string> {
  const { data, error: refreshError } = await supabase.auth.refreshSession()
  if (!refreshError && data.session?.access_token) {
    return data.session.access_token
  }
  // refreshSession() failed — try to use the cached session as a last resort,
  // but only if the token is not already expired (expired tokens cause gateway 401s).
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token || isJwtExpired(token)) {
    const reason = refreshError?.message ?? 'session expirée'
    throw new Error(`Session expirée (${reason}) — veuillez vous déconnecter puis reconnecter`)
  }
  return token
}

export function useSumUpConnection(userId: string): UseSumUpConnectionResult {
  const queryClient = useQueryClient()

  const query = useQuery<IntegrationRow | null>({
    queryKey: ['sumup-connection', userId],
    queryFn: () => fetchIntegrationByUserId(userId),
    enabled: Boolean(userId),
    refetchInterval: false,
    staleTime: 60_000,
  })

  const row = query.data ?? null

  // ── connect ──────────────────────────────────────────────────────────────
  async function connect(): Promise<void> {
    const token = await getAccessTokenOrThrow()

    const res = await fetch(
      `${config.supabaseUrl}/functions/v1/sumup-oauth-init`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: config.supabaseAnonKey,
        },
      },
    )

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string; message?: string }
      if (res.status === 401 || res.status === 403) {
        throw new Error('Session invalide — veuillez vous déconnecter puis reconnecter')
      }
      throw new Error(body.error ?? body.message ?? `Erreur ${res.status} lors de la connexion SumUp`)
    }

    const data = await res.json() as { authorize_url?: string }
    if (!data.authorize_url) throw new Error("URL d'autorisation manquante dans la réponse")

    window.location.href = data.authorize_url
  }

  // ── disconnect ───────────────────────────────────────────────────────────
  async function disconnect(): Promise<void> {
    if (!row?.id) return

    const { error } = await supabase
      .from('provider_integrations')
      .update({ status: 'revoked' })
      .eq('id', row.id)

    if (error) throw new Error(error.message)

    await queryClient.invalidateQueries({ queryKey: ['sumup-connection', userId] })
  }

  return useMemo(
    () => ({
      connectionStatus: deriveStatus(row),
      merchantName: row?.sumup_merchant_name ?? null,
      merchantCode: row?.sumup_merchant_code ?? null,
      connectedAt: row ? new Date(row.created_at) : null,
      isLoading: query.isLoading,
      connect,
      disconnect,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, query.isLoading, userId],
  )
}
