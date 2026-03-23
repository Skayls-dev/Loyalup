import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export type ScanHistoryStatus = 'success' | 'failed'

export interface ScanHistoryItem {
  id: string
  user_id: string
  merchant_id: string | null
  network_id: string | null
  merchant_name: string
  network_name: string
  status: ScanHistoryStatus
  points: number
  reason: string | null
  created_at: string
}

export interface UseScanHistoryResult {
  scans: ScanHistoryItem[]
  loading: boolean
  error: string | null
  latestInsertedId: string | null
}

type QrScanRow = Record<string, unknown>

function toStatus(raw: unknown): ScanHistoryStatus {
  const value = String(raw ?? '').toLowerCase()
  if (value === 'success' || value === 'validated' || value === 'ok') return 'success'
  return 'failed'
}

function mapRow(row: QrScanRow): ScanHistoryItem {
  const merchantJoin = row.m as { name?: unknown } | undefined
  const networkJoin = row.n as { name?: unknown } | undefined

  return {
    id: String(row.id ?? crypto.randomUUID()),
    user_id: String(row.user_id ?? ''),
    merchant_id: row.merchant_id ? String(row.merchant_id) : null,
    network_id: row.network_id ? String(row.network_id) : null,
    merchant_name: typeof merchantJoin?.name === 'string' ? merchantJoin.name : 'Marchand',
    network_name: typeof networkJoin?.name === 'string' ? networkJoin.name : 'Réseau Looyaal',
    status: toStatus(row.status),
    points: Number(row.points ?? row.points_earned ?? row.points_credited ?? 0),
    reason: row.reason ? String(row.reason) : row.failure_reason ? String(row.failure_reason) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  }
}

export function useScanHistory(userId: string, limit = 4): UseScanHistoryResult {
  const [scans, setScans] = useState<ScanHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestInsertedId, setLatestInsertedId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setScans([])
      setLoading(false)
      setError(null)
      setLatestInsertedId(null)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('qr_scans')
        .select('*, m:merchant_id(name), n:network_id(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(Math.max(1, limit))

      if (cancelled) return

      if (queryError) {
        setLoading(false)
        setError(queryError.message)
        setScans([])
        return
      }

      setScans(((data ?? []) as QrScanRow[]).map(mapRow))
      setLoading(false)
    }

    void load()

    const channel = supabase
      .channel(`qr-scans-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'qr_scans',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as QrScanRow
          const mapped = mapRow(incoming)
          setLatestInsertedId(mapped.id)
          setScans((prev) => [mapped, ...prev.filter((row) => row.id !== mapped.id)].slice(0, Math.max(1, limit)))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [limit, userId])

  return useMemo(() => ({ scans, loading, error, latestInsertedId }), [scans, loading, error, latestInsertedId])
}
