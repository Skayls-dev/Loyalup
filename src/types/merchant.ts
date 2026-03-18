export type MerchantTier = 'Gold' | 'Silver' | 'Bronze'

export interface MerchantStats {
  revenue: number
  points_given: number
  unique_customers: number
  retention_rate: number
}

export interface MerchantRevenuePoint {
  key: string
  label: string
  revenue: number
  points_given: number
}

export interface MerchantRevenueChart {
  period_days: number
  daily: MerchantRevenuePoint[]
  weekly: MerchantRevenuePoint[]
}

export interface MerchantRecentTransaction {
  id: string
  user_id: string
  user_name: string
  tier: MerchantTier
  network_id: string | null
  network_name: string
  points_given: number
  amount: number
  created_at: string
}

export interface MerchantActiveOffer {
  id: string
  name: string
  description: string | null
  points_required: number
  redemption_count: number
  expiry_date: string | null
  status: 'active' | 'paused' | 'expired'
  category: string | null
}

export interface MerchantNetworkSummary {
  id: string
  name: string
  emoji: string
  multiplier: number
  primary_color: string
  secondary_color: string | null
  points_total: number
}

export interface MerchantTopCustomer {
  user_id: string
  name: string
  tier: MerchantTier
  visits: number
  points: number
}

export interface MerchantDashboardData {
  stats: MerchantStats
  revenueChart: MerchantRevenueChart
  recentTransactions: MerchantRecentTransaction[]
  activeOffers: MerchantActiveOffer[]
  networks: MerchantNetworkSummary[]
  topCustomers: MerchantTopCustomer[]
}

export interface UseMerchantDashboardResult {
  data: MerchantDashboardData
  isLoading: boolean
  isFetching: boolean
  error: string | null
  refetch: () => Promise<unknown>
}
