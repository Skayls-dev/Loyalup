import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export type MerchantOfferStatus = 'active' | 'paused' | 'expired'

export interface MerchantOffer {
  id: string
  merchant_id: string
  name: string
  description: string | null
  points_required: number
  expiry_date: string | null
  category: string | null
  reward_delivery_type: 'in_store' | 'digital_code'
  status: MerchantOfferStatus
  redemptions_this_month: number
  network_ids: string[]
  created_at: string
}

export interface UseMerchantOffersResult {
  offers: MerchantOffer[]
  loading: boolean
  error: string | null
}

type OfferRow = {
  id: string
  fournisseur_id: string
  nom: string
  description: string | null
  points_required: number | null
  emoji: string | null
  expiry_date: string | null
  reward_delivery_type: 'in_store' | 'digital_code' | null
  actif: boolean | null
  created_at: string
}

function toOffer(row: OfferRow, redemptionsByRuleId: Map<string, number>): MerchantOffer {
  const redemptions = redemptionsByRuleId.get(row.id) ?? 0
  const today = new Date().toISOString().slice(0, 10)
  const isExpiredByDate = Boolean(row.expiry_date && row.expiry_date < today)

  return {
    id: row.id,
    merchant_id: row.fournisseur_id,
    name: row.nom,
    description: row.description,
    points_required: Number(row.points_required ?? 0),
    expiry_date: row.expiry_date,
    category: row.emoji,
    reward_delivery_type: row.reward_delivery_type === 'digital_code' ? 'digital_code' : 'in_store',
    status: isExpiredByDate ? 'expired' : row.actif === false ? 'paused' : 'active',
    redemptions_this_month: redemptions,
    network_ids: [],
    created_at: row.created_at,
  }
}

async function loadMonthlyRedemptions(ruleIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (ruleIds.length === 0) return counts

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('client_rewards')
    .select('reward_rule_id')
    .in('reward_rule_id', ruleIds)
    .eq('status', 'used')
    .gte('used_at', startOfMonth.toISOString())

  if (error) return counts

  for (const row of (data ?? []) as Array<{ reward_rule_id: string | null }>) {
    if (!row.reward_rule_id) continue
    counts.set(row.reward_rule_id, (counts.get(row.reward_rule_id) ?? 0) + 1)
  }

  return counts
}

export function useMerchantOffers(merchantId: string): UseMerchantOffersResult {
  const [offers, setOffers] = useState<MerchantOffer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!merchantId) {
      setOffers([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('reward_rules')
        .select('*')
        .eq('fournisseur_id', merchantId)
        .order('created_at', { ascending: false })

      if (cancelled) {
        return
      }

      if (queryError) {
        setOffers([])
        setLoading(false)
        setError(queryError.message)
        return
      }

      const rows = (data ?? []) as OfferRow[]
      const redemptionCounts = await loadMonthlyRedemptions(rows.map((row) => row.id))

      if (cancelled) {
        return
      }

      const mapped = rows.map((row) => toOffer(row, redemptionCounts))
      setOffers(mapped)
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [merchantId])

  return useMemo(() => ({ offers, loading, error }), [offers, loading, error])
}
