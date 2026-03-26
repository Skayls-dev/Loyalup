import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export type MerchantBadge = 'Top conversion' | 'Mieux note' | 'Nouveau'

export interface MarketplaceMerchant {
  merchantId: string
  merchantName: string
  address: string | null
  city: string | null
  avgRating: number
  ratingCount: number
  activeOffers: number
  transactions30d: number
  avgOfferConversionRate: number
  performanceScore: number
  badges: MerchantBadge[]
}

export interface MarketplaceOffer {
  offerId: string
  merchantId: string
  merchantName: string
  name: string
  category: string | null
  rewardDeliveryType: 'in_store' | 'digital_code'
  pointsRequired: number
  active: boolean
  createdAt: string
  redemptions30d: number
  conversionRate: number
  merchantAvgRating: number
  merchantRatingCount: number
  performanceScore: number
  badges: MerchantBadge[]
}

export interface MerchantRankingInsight {
  rank: number
  total: number
  score: number
  tips: string[]
}

export interface UseMarketplaceInsightsResult {
  merchants: MarketplaceMerchant[]
  offers: MarketplaceOffer[]
  merchantRanking: MerchantRankingInsight | null
  loading: boolean
  error: string | null
}

type ProviderRow = {
  id: string
  nom_commerce: string | null
  adresse: string | null
}

type OfferRow = {
  id: string
  fournisseur_id: string | null
  nom: string | null
  points_required: number | null
  actif: boolean | null
  created_at: string
  emoji: string | null
  reward_delivery_type: 'in_store' | 'digital_code' | null
}

type RatingRow = {
  fournisseur_id: string | null
  rating: number | null
}

type TransactionRow = {
  fournisseur_id: string | null
}

type RewardUsageRow = {
  reward_rule_id: string | null
  status: string | null
}

function normalizeCity(address: string | null): string | null {
  if (!address) return null
  const chunks = address.split(',').map((value) => value.trim()).filter(Boolean)
  return chunks.length > 0 ? chunks[chunks.length - 1] : null
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function normalizeByMax(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0 || max <= 0) return 0
  return clamp01(value / max)
}

function daysSince(isoDate: string): number {
  const created = new Date(isoDate).getTime()
  if (!Number.isFinite(created)) return 365
  return Math.max(0, (Date.now() - created) / (1000 * 60 * 60 * 24))
}

function scoreToPercent(score01: number): number {
  return Math.round(clamp01(score01) * 100)
}

async function safeSelect<T>(promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<{ data: T[]; error: string | null }> {
  try {
    const result = await promise
    return { data: (result.data ?? []) as T[], error: result.error?.message ?? null }
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : 'Erreur de chargement' }
  }
}

export function useMarketplaceInsights(currentMerchantId?: string): UseMarketplaceInsightsResult {
  const [merchants, setMerchants] = useState<MarketplaceMerchant[]>([])
  const [offers, setOffers] = useState<MarketplaceOffer[]>([])
  const [merchantRanking, setMerchantRanking] = useState<MerchantRankingInsight | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [providersRes, offersRes, ratingsRes, txRes, rewardsRes] = await Promise.all([
        safeSelect<ProviderRow>(supabase.from('fournisseurs').select('id, nom_commerce, adresse').order('nom_commerce', { ascending: true })),
        safeSelect<OfferRow>(supabase.from('reward_rules').select('id, fournisseur_id, nom, points_required, actif, created_at, emoji, reward_delivery_type').order('created_at', { ascending: false })),
        safeSelect<RatingRow>(supabase.from('merchant_ratings').select('fournisseur_id, rating')),
        safeSelect<TransactionRow>(supabase.from('transactions').select('fournisseur_id').eq('status', 'validated').gte('created_at', since30d)),
        safeSelect<RewardUsageRow>(supabase.from('client_rewards').select('reward_rule_id, status').gte('created_at', since30d)),
      ])

      if (cancelled) return

      const providers = providersRes.data
      const offersRows = offersRes.data.filter((row) => Boolean(row.fournisseur_id && row.id))
      const ratingsRows = ratingsRes.data.filter((row) => Boolean(row.fournisseur_id && row.rating))
      const txRows = txRes.data.filter((row) => Boolean(row.fournisseur_id))
      const rewardRows = rewardsRes.data.filter((row) => Boolean(row.reward_rule_id))

      const errors = [providersRes.error, offersRes.error, ratingsRes.error, txRes.error, rewardsRes.error].filter(Boolean)
      if (errors.length > 0) {
        // Non-fatal: we still build with partial data.
        setError(errors[0] ?? null)
      }

      const providerNameById = new Map<string, { name: string; address: string | null; city: string | null }>()
      for (const provider of providers) {
        providerNameById.set(provider.id, {
          name: provider.nom_commerce?.trim() || 'Marchand',
          address: provider.adresse ?? null,
          city: normalizeCity(provider.adresse ?? null),
        })
      }

      const ratingsByMerchant = new Map<string, { sum: number; count: number }>()
      for (const rating of ratingsRows) {
        if (!rating.fournisseur_id) continue
        const current = ratingsByMerchant.get(rating.fournisseur_id) ?? { sum: 0, count: 0 }
        current.sum += Number(rating.rating ?? 0)
        current.count += 1
        ratingsByMerchant.set(rating.fournisseur_id, current)
      }

      const txByMerchant = new Map<string, number>()
      for (const tx of txRows) {
        if (!tx.fournisseur_id) continue
        txByMerchant.set(tx.fournisseur_id, (txByMerchant.get(tx.fournisseur_id) ?? 0) + 1)
      }

      const claimByOffer = new Map<string, number>()
      const usedByOffer = new Map<string, number>()
      for (const reward of rewardRows) {
        if (!reward.reward_rule_id) continue
        claimByOffer.set(reward.reward_rule_id, (claimByOffer.get(reward.reward_rule_id) ?? 0) + 1)
        if (reward.status === 'used') {
          usedByOffer.set(reward.reward_rule_id, (usedByOffer.get(reward.reward_rule_id) ?? 0) + 1)
        }
      }

      const maxTransactions = Math.max(1, ...Array.from(txByMerchant.values()))

      const mappedOffers: MarketplaceOffer[] = offersRows.map((row) => {
        const merchantId = row.fournisseur_id as string
        const merchant = providerNameById.get(merchantId)
        const ratingsAgg = ratingsByMerchant.get(merchantId) ?? { sum: 0, count: 0 }
        const avgRating = ratingsAgg.count > 0 ? ratingsAgg.sum / ratingsAgg.count : 0
        const ratingNorm = clamp01(avgRating / 5)
        const claims = claimByOffer.get(row.id) ?? 0
        const used = usedByOffer.get(row.id) ?? 0
        const conversionRate = claims > 0 ? used / claims : 0
        const recencyNorm = clamp01(1 - daysSince(row.created_at) / 30)
        const score = 0.45 * clamp01(conversionRate) + 0.35 * ratingNorm + 0.2 * recencyNorm

        const badges: MerchantBadge[] = []
        if (conversionRate >= 0.35 && claims >= 5) badges.push('Top conversion')
        if (avgRating >= 4.5 && ratingsAgg.count >= 3) badges.push('Mieux note')
        if (daysSince(row.created_at) <= 14) badges.push('Nouveau')

        return {
          offerId: row.id,
          merchantId,
          merchantName: merchant?.name ?? 'Marchand',
          name: row.nom?.trim() || 'Offre',
          category: row.emoji,
          rewardDeliveryType: row.reward_delivery_type === 'digital_code' ? 'digital_code' : 'in_store',
          pointsRequired: Number(row.points_required ?? 0),
          active: row.actif !== false,
          createdAt: row.created_at,
          redemptions30d: used,
          conversionRate,
          merchantAvgRating: avgRating,
          merchantRatingCount: ratingsAgg.count,
          performanceScore: scoreToPercent(score),
          badges,
        }
      })

      const offersByMerchant = new Map<string, MarketplaceOffer[]>()
      for (const offer of mappedOffers) {
        const list = offersByMerchant.get(offer.merchantId) ?? []
        list.push(offer)
        offersByMerchant.set(offer.merchantId, list)
      }

      const mappedMerchants: MarketplaceMerchant[] = providers.map((provider) => {
        const merchantOffers = offersByMerchant.get(provider.id) ?? []
        const activeOffers = merchantOffers.filter((offer) => offer.active).length
        const avgOfferConversion = merchantOffers.length > 0
          ? merchantOffers.reduce((sum, offer) => sum + offer.conversionRate, 0) / merchantOffers.length
          : 0

        const ratingsAgg = ratingsByMerchant.get(provider.id) ?? { sum: 0, count: 0 }
        const avgRating = ratingsAgg.count > 0 ? ratingsAgg.sum / ratingsAgg.count : 0
        const ratingNorm = clamp01(avgRating / 5)
        const txCount = txByMerchant.get(provider.id) ?? 0
        const txNorm = normalizeByMax(txCount, maxTransactions)
        const conversionNorm = clamp01(avgOfferConversion)
        const score = 0.4 * txNorm + 0.35 * ratingNorm + 0.25 * conversionNorm

        const newestOfferAge = merchantOffers.length > 0
          ? Math.min(...merchantOffers.map((offer) => daysSince(offer.createdAt)))
          : 365

        const badges: MerchantBadge[] = []
        if (avgOfferConversion >= 0.35 && merchantOffers.length >= 2) badges.push('Top conversion')
        if (avgRating >= 4.5 && ratingsAgg.count >= 3) badges.push('Mieux note')
        if (newestOfferAge <= 14) badges.push('Nouveau')

        const profile = providerNameById.get(provider.id)

        return {
          merchantId: provider.id,
          merchantName: profile?.name ?? 'Marchand',
          address: profile?.address ?? null,
          city: profile?.city ?? null,
          avgRating,
          ratingCount: ratingsAgg.count,
          activeOffers,
          transactions30d: txCount,
          avgOfferConversionRate: avgOfferConversion,
          performanceScore: scoreToPercent(score),
          badges,
        }
      })

      mappedMerchants.sort((a, b) => b.performanceScore - a.performanceScore)

      let ranking: MerchantRankingInsight | null = null
      if (currentMerchantId) {
        const index = mappedMerchants.findIndex((item) => item.merchantId === currentMerchantId)
        if (index >= 0) {
          const current = mappedMerchants[index]
          const tips: string[] = []
          if (current.avgRating < 4.2) tips.push('Collectez plus d avis clients pour renforcer la confiance.')
          if (current.avgOfferConversionRate < 0.2) tips.push('Optimisez vos offres (valeur immediate, expiration claire) pour augmenter la conversion.')
          if (current.activeOffers < 3) tips.push('Publiez plus d offres actives pour booster votre visibilite dans l annuaire.')
          if (tips.length === 0) tips.push('Excellent niveau: maintenez la qualite et renouvelez regulierement vos offres.')

          ranking = {
            rank: index + 1,
            total: mappedMerchants.length,
            score: current.performanceScore,
            tips,
          }
        }
      }

      if (!cancelled) {
        setMerchants(mappedMerchants)
        setOffers(mappedOffers)
        setMerchantRanking(ranking)
        setLoading(false)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [currentMerchantId])

  return useMemo(
    () => ({ merchants, offers, merchantRanking, loading, error }),
    [merchants, offers, merchantRanking, loading, error],
  )
}
