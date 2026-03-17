export type Period = '7d' | '30d' | '90d' | '365d'

export type InstitutionNetworkInfo = {
  id: string
  slug: string
  name: Record<string, string> | null
  member_count: number
  client_count: number
}

export type PeriodStats = {
  new_clients: number
  active_merchants: number
  total_bonus_distributed: number
  transaction_count: number
}

export type GrowthStats = {
  clients_pct: number
  merchants_pct: number
}

export type InstitutionOverview = {
  network: InstitutionNetworkInfo
  period_stats: PeriodStats
  growth: GrowthStats
}

export type GrowthPoint = {
  date: string
  new_clients: number
  cumulative: number
}

export type MerchantLeaderboardEntry = {
  nom_commerce: string
  city: string | null
  country: string | null
  unique_clients: number
  total_bonus_points: number
  transaction_count: number
}

export type GeographicEntry = {
  country: string
  city: string | null
  merchant_count: number
  client_count: number
}
