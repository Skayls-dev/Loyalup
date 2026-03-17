import { supabase } from '@/shared/lib/supabaseClient'

export type Period = '7d' | '30d' | '90d' | '365d'

export interface NetworkInfo {
  id: string
  slug: string
  name: Record<string, string> | null
  member_count: number
  client_count: number
}

export interface PeriodStats {
  new_clients: number
  active_merchants: number
  total_bonus_distributed: number
  transaction_count: number
}

export interface Growth {
  clients_pct: number
  merchants_pct: number
}

export interface InstitutionOverview {
  network: NetworkInfo
  period_stats: PeriodStats
  growth: Growth
}

export interface GrowthPoint {
  date: string
  new_clients: number
  cumulative: number
}

export interface MerchantLeaderboardEntry {
  nom_commerce: string
  city: string | null
  country: string | null
  unique_clients: number
  total_bonus_points: number
  transaction_count: number
}

export interface GeographicEntry {
  country: string
  city: string | null
  merchant_count: number
  client_count: number
}

export async function getOverview(period: Period = '30d'): Promise<InstitutionOverview> {
  const { data, error } = await supabase.functions.invoke('institution-analytics', {
    body: {
      action: 'getOverview',
      period,
    },
  })

  if (error) {
    throw new Error(`Failed to get overview: ${error.message}`)
  }

  return data.overview as InstitutionOverview
}

export async function getClientGrowthTimeline(period: Period = '30d'): Promise<GrowthPoint[]> {
  const { data, error } = await supabase.functions.invoke('institution-analytics', {
    body: {
      action: 'getClientGrowthTimeline',
      period,
    },
  })

  if (error) {
    throw new Error(`Failed to get growth timeline: ${error.message}`)
  }

  return data.timeline as GrowthPoint[]
}

export async function getMerchantLeaderboard(period: Period = '30d'): Promise<MerchantLeaderboardEntry[]> {
  const { data, error } = await supabase.functions.invoke('institution-analytics', {
    body: {
      action: 'getMerchantLeaderboard',
      period,
    },
  })

  if (error) {
    throw new Error(`Failed to get merchant leaderboard: ${error.message}`)
  }

  return data.leaderboard as MerchantLeaderboardEntry[]
}

export async function getGeographicBreakdown(): Promise<GeographicEntry[]> {
  const { data, error } = await supabase.functions.invoke('institution-analytics', {
    body: {
      action: 'getGeographicBreakdown',
    },
  })

  if (error) {
    throw new Error(`Failed to get geographic breakdown: ${error.message}`)
  }

  return data.breakdown as GeographicEntry[]
}
