export type DashboardTierLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

export interface DashboardStats {
  totalPoints: number
  activeNetworksCount: number
  monthlyTransactionsCount: number
  currentTier: DashboardTierLevel
}

export interface DashboardNetwork {
  id: string
  name: string
  emoji: string
  bgColor: string
  badgeColor: string
  points: number
  merchantCount: number
  multiplier: number
  nextThreshold: number
  progressPercent: number
}

export interface DashboardRecentTransaction {
  id: string
  merchantName: string
  merchantEmoji: string
  networkId: string | null
  networkName: string
  networkColor: string
  points: number
  createdAt: string
}

export interface DashboardChallenge {
  id: string
  icon: string
  name: string
  current: number
  target: number
  rewardPoints: number
  progressPercent: number
}

export interface DashboardTier {
  current: DashboardTierLevel
  currentThreshold: number
  next: DashboardTierLevel | null
  nextThreshold: number | null
  pointsToNext: number
  progressPercent: number
}

export interface DashboardPayload {
  stats: DashboardStats
  networks: DashboardNetwork[]
  recentTransactions: DashboardRecentTransaction[]
  challenges: DashboardChallenge[]
  tier: DashboardTier
}

export interface UseDashboardResult extends DashboardPayload {
  isLoading: boolean
  error: string | null
}
