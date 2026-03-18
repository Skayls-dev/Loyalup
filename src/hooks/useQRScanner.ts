import { useCallback, useState } from 'react'
import { useAuth } from '../modules/auth/hooks/useAuth'
import { supabase } from '../shared/lib/supabaseClient'

export interface QRPayload {
  merchantId: string
  networkId: string
  timestamp: number
  signature: string
}

export interface ScanResult {
  points: number
  basePoints: number
  bonusPoints: number
  multiplier: number
  merchantName: string
  networkName: string
  amount?: number
  userTotalPoints: number
  nextTierThreshold: number
}

export type ScanError = 'expired' | 'invalid' | 'network_mismatch' | 'already_scanned' | 'server_error'

interface ProcessQrScanRpcResponse {
  points?: number
  points_credited?: number
  basePoints?: number
  base_points?: number
  bonusPoints?: number
  bonus_points?: number
  multiplier?: number
  merchantName?: string
  merchant_name?: string
  networkName?: string
  network_name?: string
  amount?: number
  montant?: number
  userTotalPoints?: number
  user_total_points?: number
  nextTierThreshold?: number
  next_tier_threshold?: number
}

interface UseQRScannerResult {
  processScan: (payload: QRPayload) => Promise<ScanResult>
  isLoading: boolean
  error: ScanError | null
  clearError: () => void
}

const QR_MAX_AGE_MS = 86_400_000

function normalizeSignature(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-f0-9]/g, '')
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

async function computeHmacHex(secret: string, payload: QRPayload): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const data = `${payload.merchantId}:${payload.networkId}:${payload.timestamp}`
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function merchantExists(merchantId: string): Promise<boolean> {
  const merchantRes = await supabase
    .from('merchants')
    .select('id')
    .eq('id', merchantId)
    .maybeSingle<{ id: string }>()

  if (!merchantRes.error && merchantRes.data?.id) {
    return true
  }

  // Schema compatibility for this codebase where providers are stored in fournisseurs.
  const providerRes = await supabase
    .from('fournisseurs')
    .select('id')
    .eq('id', merchantId)
    .maybeSingle<{ id: string }>()

  return Boolean(!providerRes.error && providerRes.data?.id)
}

async function userHasActiveNetwork(userId: string, networkId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_networks')
    .select('id')
    .eq('user_id', userId)
    .eq('network_id', networkId)
    .limit(1)

  if (error) {
    return false
  }

  return Boolean((data ?? []).length)
}

async function scannedToday(userId: string, merchantId: string): Promise<boolean> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const [scanRes, txRes] = await Promise.all([
    supabase
      .from('qr_scans')
      .select('id')
      .eq('user_id', userId)
      .eq('merchant_id', merchantId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .limit(1),
    supabase
      .from('transactions')
      .select('id')
      .eq('client_id', userId)
      .eq('fournisseur_id', merchantId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .limit(1),
  ])

  if (!scanRes.error && (scanRes.data ?? []).length > 0) {
    return true
  }

  if (!txRes.error && (txRes.data ?? []).length > 0) {
    return true
  }

  return false
}

export function useQRScanner(): UseQRScannerResult {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ScanError | null>(null)

  const validateQRPayload = useCallback(
    async (payload: QRPayload): Promise<ScanError | null> => {
      if (!payload.merchantId || !payload.networkId || !payload.signature || !Number.isFinite(payload.timestamp)) {
        return 'invalid'
      }

      if (Date.now() - payload.timestamp > QR_MAX_AGE_MS) {
        return 'expired'
      }

      const signatureSecret = (import.meta.env.VITE_QR_SIGNATURE_SECRET as string | undefined)?.trim() ?? ''
      if (!signatureSecret) {
        return 'invalid'
      }

      try {
        const expected = await computeHmacHex(signatureSecret, payload)
        if (normalizeSignature(expected) !== normalizeSignature(payload.signature)) {
          return 'invalid'
        }
      } catch {
        return 'server_error'
      }

      const userId = user?.id
      if (!userId) {
        return 'server_error'
      }

      const exists = await merchantExists(payload.merchantId)
      if (!exists) {
        return 'invalid'
      }

      const inUserNetworks = await userHasActiveNetwork(userId, payload.networkId)
      if (!inUserNetworks) {
        return 'network_mismatch'
      }

      const duplicated = await scannedToday(userId, payload.merchantId)
      if (duplicated) {
        return 'already_scanned'
      }

      return null
    },
    [user?.id],
  )

  const processScan = useCallback(
    async (payload: QRPayload): Promise<ScanResult> => {
      setIsLoading(true)
      setError(null)

      try {
        const userId = user?.id
        if (!userId) {
          throw new Error('server_error')
        }

        const validationError = await validateQRPayload(payload)
        if (validationError) {
          setError(validationError)
          throw new Error(validationError)
        }

        const { data, error: rpcError } = await supabase.rpc('process_qr_scan', {
          p_merchant_id: payload.merchantId,
          p_network_id: payload.networkId,
          p_user_id: userId,
        })

        if (rpcError || !data) {
          setError('server_error')
          throw new Error('server_error')
        }

        const row = data as ProcessQrScanRpcResponse

        const points = toNumber(row.points ?? row.points_credited, 0)
        const basePoints = toNumber(row.basePoints ?? row.base_points, points)
        const bonusPoints = toNumber(row.bonusPoints ?? row.bonus_points, Math.max(0, points - basePoints))

        const result: ScanResult = {
          points,
          basePoints,
          bonusPoints,
          multiplier: toNumber(row.multiplier, 1),
          merchantName: String(row.merchantName ?? row.merchant_name ?? 'Marchand'),
          networkName: String(row.networkName ?? row.network_name ?? 'Réseau LoyalUp'),
          amount: row.amount !== undefined || row.montant !== undefined ? toNumber(row.amount ?? row.montant, 0) : undefined,
          userTotalPoints: toNumber(row.userTotalPoints ?? row.user_total_points, 0),
          nextTierThreshold: toNumber(row.nextTierThreshold ?? row.next_tier_threshold, 1000),
        }

        setIsLoading(false)
        return result
      } catch (caughtError) {
        const reason = caughtError instanceof Error ? (caughtError.message as ScanError) : 'server_error'
        if (!['expired', 'invalid', 'network_mismatch', 'already_scanned', 'server_error'].includes(reason)) {
          setError('server_error')
        }
        setIsLoading(false)
        throw caughtError
      }
    },
    [user?.id, validateQRPayload],
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    processScan,
    isLoading,
    error,
    clearError,
  }
}
