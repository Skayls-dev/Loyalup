import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../shared/lib/supabaseClient'
import { config } from '../../../shared/lib/env'
import type { SumUpConnectionStatus } from '../../../shared/types/integrations'

const sandboxMerchantCodeStorageKey = (userId: string) => `looyaal:sumup-sandbox-merchant-code:${userId}`

function readSandboxMerchantCodeFromStorage(userId: string): string | null {
  if (!userId || typeof window === 'undefined') return null
  const value = window.localStorage.getItem(sandboxMerchantCodeStorageKey(userId))?.trim()
  return value || null
}

function writeSandboxMerchantCodeToStorage(userId: string, value: string | null): void {
  if (!userId || typeof window === 'undefined') return
  if (!value) {
    window.localStorage.removeItem(sandboxMerchantCodeStorageKey(userId))
    return
  }

  window.localStorage.setItem(sandboxMerchantCodeStorageKey(userId), value)
}

type IntegrationRow = {
  id: string
  fournisseur_id: string
  status: string
  sumup_merchant_code: string | null
  sumup_sandbox_merchant_code: string | null
  sumup_merchant_name: string | null
  local_merchant_name?: string | null
  created_at: string
  expires_at: string
}

type UseSumUpConnectionResult = {
  connectionStatus: SumUpConnectionStatus
  merchantName: string | null
  merchantNameSource: 'sumup' | 'local' | null
  merchantCode: string | null
  sandboxMerchantCode: string | null
  connectedAt: Date | null
  isLoading: boolean
  isVerifying: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  verify: () => Promise<{ alive: boolean; reason?: string }>
  saveSandboxMerchantCode: (value: string) => Promise<'remote' | 'local'>
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
    .select('id, nom_commerce')
    .eq('user_id', userId)
    .maybeSingle<{ id: string; nom_commerce?: string | null }>()

  if (fErr || !fournisseur?.id) return null

  // 2. Fetch integration row
  const { data, error } = await supabase
    .from('provider_integrations')
    .select('id, fournisseur_id, status, sumup_merchant_code, sumup_sandbox_merchant_code, sumup_merchant_name, created_at, expires_at')
    .eq('fournisseur_id', fournisseur.id)
    .eq('provider', 'sumup')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    ...(data as IntegrationRow),
    local_merchant_name: fournisseur.nom_commerce ?? null,
  }
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
  const [isVerifying, setIsVerifying] = useState(false)
  const [localSandboxMerchantCode, setLocalSandboxMerchantCode] = useState<string | null>(() => readSandboxMerchantCodeFromStorage(userId))

  const query = useQuery<IntegrationRow | null>({
    queryKey: ['sumup-connection', userId],
    queryFn: () => fetchIntegrationByUserId(userId),
    enabled: Boolean(userId),
    refetchInterval: false,
    staleTime: 60_000,
  })

  const row = query.data ?? null
  const sandboxMerchantCode = row
    ? row.sumup_sandbox_merchant_code ?? null
    : localSandboxMerchantCode ?? null

  useEffect(() => {
    setLocalSandboxMerchantCode(readSandboxMerchantCodeFromStorage(userId))
  }, [userId])

  useEffect(() => {
    if (!row) return
    writeSandboxMerchantCodeToStorage(userId, row.sumup_sandbox_merchant_code ?? null)
    setLocalSandboxMerchantCode(row.sumup_sandbox_merchant_code ?? null)
  }, [row, userId])

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
        throw new Error(body.error ?? body.message ?? 'Session invalide — veuillez vous déconnecter puis reconnecter')
      }
      throw new Error(body.error ?? body.message ?? `Erreur ${res.status} lors de la connexion SumUp`)
    }

    const data = await res.json() as { authorize_url?: string }
    if (!data.authorize_url) throw new Error("URL d'autorisation manquante dans la réponse")

    window.location.href = data.authorize_url
  }

  // ── verify ────────────────────────────────────────────────────────────────
  async function verify(): Promise<{ alive: boolean; reason?: string }> {
    setIsVerifying(true)
    try {
      const token = await getAccessTokenOrThrow()
      const res = await fetch(
        `${config.supabaseUrl}/functions/v1/sumup-verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: config.supabaseAnonKey,
          },
        },
      )
      const data = await res.json() as { alive?: boolean; reason?: string }
      // If the function detected a revoked/broken token, refresh the UI
      if (!data.alive) {
        await queryClient.invalidateQueries({ queryKey: ['sumup-connection', userId] })
      }
      return { alive: data.alive ?? false, reason: data.reason }
    } finally {
      setIsVerifying(false)
    }
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

  async function saveSandboxMerchantCode(value: string): Promise<'remote' | 'local'> {
    const normalizedValue = value.trim() || null

    writeSandboxMerchantCodeToStorage(userId, normalizedValue)
    setLocalSandboxMerchantCode(normalizedValue)

    if (!row?.id) {
      return 'local'
    }

    const { error } = await supabase
      .from('provider_integrations')
      .update({ sumup_sandbox_merchant_code: normalizedValue })
      .eq('id', row.id)

    if (error) throw new Error(error.message)

    await queryClient.invalidateQueries({ queryKey: ['sumup-connection', userId] })
    return 'remote'
  }

  return useMemo(
    () => ({
      // Prefer SumUp profile name when available, otherwise fallback to local merchant name.
      merchantNameSource: row?.sumup_merchant_name
        ? 'sumup'
        : row?.local_merchant_name
          ? 'local'
          : null,
      connectionStatus: deriveStatus(row),
      merchantName: row?.sumup_merchant_name ?? row?.local_merchant_name ?? null,
      merchantCode: row?.sumup_merchant_code ?? null,
      sandboxMerchantCode,
      connectedAt: row ? new Date(row.created_at) : null,
      isLoading: query.isLoading,
      isVerifying,
      connect,
      disconnect,
      verify,
      saveSandboxMerchantCode,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, sandboxMerchantCode, query.isLoading, userId, isVerifying],
  )
}
