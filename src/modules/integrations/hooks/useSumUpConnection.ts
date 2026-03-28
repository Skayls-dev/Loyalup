import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/lib/supabaseClient'
import { config } from '../../../shared/lib/env'
import type { SumUpConnectionStatus } from '../../../shared/types/integrations'

type IntegrationRow = {
  id: string
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

async function fetchIntegration(fournisseurId: string): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from('provider_integrations')
    .select('id, status, sumup_merchant_code, sumup_merchant_name, created_at, expires_at')
    .eq('fournisseur_id', fournisseurId)
    .eq('provider', 'sumup')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as IntegrationRow | null
}

// Decode a base64url-encoded JWT segment (handles `-` and `_`, adds padding)
function decodeJwtPayload(token: string): { exp?: number } {
  try {
    const segment = token.split('.')[1]
    if (!segment) return {}
    // base64url → base64: replace URL-safe chars and add padding
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    return JSON.parse(atob(padded)) as { exp?: number }
  } catch {
    return {}
  }
}

// Helper: get a fresh access token, proactively refresh if near expiry or decode fails
async function getAccessTokenOrThrow(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData?.session
  if (!session?.access_token) throw new Error('Non authentifié')

  const payload = decodeJwtPayload(session.access_token)
  const exp = payload.exp
  // Refresh if: exp unknown, token expired, or expires within 60 s
  const needsRefresh = !exp || exp * 1000 - Date.now() < 60_000

  if (needsRefresh) {
    const { data: refreshed, error } = await supabase.auth.refreshSession()
    if (error || !refreshed.session?.access_token) throw new Error('Impossible de renouveler la session')
    return refreshed.session.access_token
  }

  return session.access_token
}

export function useSumUpConnection(fournisseurId: string): UseSumUpConnectionResult {
  const queryClient = useQueryClient()

  const query = useQuery<IntegrationRow | null>({
    queryKey: ['sumup-connection', fournisseurId],
    queryFn: () => fetchIntegration(fournisseurId),
    enabled: Boolean(fournisseurId),
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
      const body = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(body.error ?? "Impossible d'initier la connexion SumUp")
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

    await queryClient.invalidateQueries({ queryKey: ['sumup-connection', fournisseurId] })
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
    [row, query.isLoading, fournisseurId],
  )
}
