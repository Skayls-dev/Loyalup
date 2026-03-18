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
  merchant_id: string
  name: string
  description: string | null
  points_required: number | null
  expiry_date: string | null
  category: string | null
  status: string | null
  redemptions_this_month?: number | null
  redemptions_month?: number | null
  redemptions_count?: number | null
  network_ids?: string[] | null
  created_at: string
}

function normalizeStatus(status: string | null, expiryDate: string | null): MerchantOfferStatus {
  const normalized = (status ?? '').toLowerCase().trim()
  if (normalized === 'paused' || normalized === 'en_pause') {
    return 'paused'
  }

  const isExpiredByDate = expiryDate ? new Date(expiryDate).getTime() < Date.now() : false
  if (normalized === 'expired' || normalized === 'expire' || isExpiredByDate) {
    return 'expired'
  }

  return 'active'
}

function toOffer(row: OfferRow): MerchantOffer {
  const redemptions = Number(row.redemptions_this_month ?? row.redemptions_month ?? row.redemptions_count ?? 0)
  return {
    id: row.id,
    merchant_id: row.merchant_id,
    name: row.name,
    description: row.description,
    points_required: Number(row.points_required ?? 0),
    expiry_date: row.expiry_date,
    category: row.category,
    status: normalizeStatus(row.status, row.expiry_date),
    redemptions_this_month: redemptions,
    network_ids: Array.isArray(row.network_ids) ? row.network_ids : [],
    created_at: row.created_at,
  }
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
        .from('merchant_offers')
        .select('*')
        .eq('merchant_id', merchantId)
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

      const mapped = ((data ?? []) as OfferRow[]).map(toOffer)
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
