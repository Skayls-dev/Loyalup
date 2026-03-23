import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export type MerchantTier = 'Gold' | 'Silver' | 'Bronze'

export interface MerchantTransactionItem {
  id: string
  customerName: string
  tier: MerchantTier
  networkName: string
  pointsGiven: number
  amount: number
  createdAt: string
}

export interface UseMerchantTransactionsResult {
  transactions: MerchantTransactionItem[]
  loading: boolean
  error: string | null
}

type TransactionRow = {
  id: string
  client_id: string | null
  montant: number | null
  points_credited: number | null
  created_at: string
}

function levelToTier(level: number): MerchantTier {
  if (level >= 8) return 'Gold'
  if (level >= 4) return 'Silver'
  return 'Bronze'
}

function resolveDisplayName(profile: { nom?: string | null }, fallbackId: string | null): string {
  if (profile.nom?.trim()) {
    return profile.nom.trim()
  }

  return fallbackId ? `Client ${fallbackId.slice(0, 6)}` : 'Client'
}

export function useMerchantTransactions(merchantId: string, limit = 4): UseMerchantTransactionsResult {
  const [transactions, setTransactions] = useState<MerchantTransactionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!merchantId) {
      setTransactions([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        // Schema adaptation: transactions currently use fournisseur_id / client_id / montant / points_credited.
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('id, client_id, montant, points_credited, created_at')
          .eq('fournisseur_id', merchantId)
          .eq('status', 'validated')
          .order('created_at', { ascending: false })
          .limit(Math.max(1, limit))

        if (txError) {
          throw new Error(txError.message)
        }

        const rows = (txData ?? []) as TransactionRow[]
        const clientIds = [...new Set(rows.map((row) => row.client_id).filter(Boolean))] as string[]

        const [profilesRes, levelsRes, networksRes] = await Promise.all([
          clientIds.length
            ? supabase.from('profiles').select('id, nom').in('id', clientIds)
            : Promise.resolve({ data: [], error: null }),
          clientIds.length
            ? supabase.from('client_levels').select('client_id, current_level').in('client_id', clientIds)
            : Promise.resolve({ data: [], error: null }),
          clientIds.length
            ? supabase
                .from('network_clients')
                .select('client_id, networks:network_id(name)')
                .in('client_id', clientIds)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (profilesRes.error) throw new Error(profilesRes.error.message)
        if (levelsRes.error) throw new Error(levelsRes.error.message)
        if (networksRes.error) throw new Error(networksRes.error.message)

        const profileMap = new Map<string, { nom?: string | null }>()
        for (const row of (profilesRes.data ?? []) as Array<{ id: string; nom?: string | null }>) {
          profileMap.set(row.id, { nom: row.nom ?? null })
        }

        const tierMap = new Map<string, MerchantTier>()
        for (const row of (levelsRes.data ?? []) as Array<{ client_id: string; current_level: number | null }>) {
          tierMap.set(row.client_id, levelToTier(Number(row.current_level ?? 1)))
        }

        const networkMap = new Map<string, string>()
        for (const row of (networksRes.data ?? []) as Array<{ client_id: string; networks?: unknown }>) {
          const raw = row.networks as unknown
          const first = Array.isArray(raw) ? raw[0] : raw
          const name = first && typeof first === 'object' ? (first as { name?: string }).name : undefined
          if (!networkMap.has(row.client_id)) {
            networkMap.set(row.client_id, name?.trim() || 'Réseau Looyaal')
          }
        }

        const mapped: MerchantTransactionItem[] = rows.map((row) => {
          const customerId = row.client_id
          const profile = customerId ? profileMap.get(customerId) ?? {} : {}

          return {
            id: row.id,
            customerName: resolveDisplayName(profile, customerId),
            tier: customerId ? tierMap.get(customerId) ?? 'Bronze' : 'Bronze',
            networkName: customerId ? networkMap.get(customerId) ?? 'Réseau Looyaal' : 'Réseau Looyaal',
            pointsGiven: Number(row.points_credited ?? 0),
            amount: Number(row.montant ?? 0),
            createdAt: row.created_at,
          }
        })

        if (!cancelled) {
          setTransactions(mapped)
          setLoading(false)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setTransactions([])
          setLoading(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger les transactions marchand')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [merchantId, limit])

  return useMemo(() => ({ transactions, loading, error }), [transactions, loading, error])
}
