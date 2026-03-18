// ─── Enums / Union types ──────────────────────────────────────────────────────

export type AdminNetworkStatus = 'active' | 'paused' | 'draft'

export type NetworkCategory =
  | 'cultural'
  | 'environmental'
  | 'religious'
  | 'social'
  | 'geographic'
  | 'demographic'
  | 'professional'
  | 'educational'
  | 'custom'

export type MembershipType = 'open' | 'invite_only' | 'validated'

export type ClientAccess = 'open' | 'invite' | 'level_required' | 'provider_only'

export type MultiplierMode = 'additive' | 'compound'

// ─── List / stats ─────────────────────────────────────────────────────────────

export interface AdminNetworkListItem {
  id: string
  slug: string
  name: string
  description: string
  emoji: string
  primaryColor: string
  category: NetworkCategory
  tags: string[]
  status: AdminNetworkStatus
  multiplier: number
  memberCount: number
  merchantCount: number
  dailyPoints: number
  retentionPct: number
  isPublic: boolean
  isFeatured: boolean
  createdAt: string
}

export interface AdminNetworksListStats {
  activeNetworks: number
  totalMerchants: number
  activeUsers: number
  pointsDistributed: number
}

export interface AdminNetworksListResult {
  items: AdminNetworkListItem[]
  stats: AdminNetworksListStats
}

// ─── Tiers ────────────────────────────────────────────────────────────────────

export interface NetworkTier {
  id?: string
  networkId?: string
  label: string
  minPoints: number
}

// ─── Institutional partners ───────────────────────────────────────────────────

export interface InstitutionalPartner {
  id: string
  networkId: string
  profileId: string
  name: string
  role: string
  joinedAt: string
}

// ─── Full config (single network) ─────────────────────────────────────────────

export interface NetworkConfig {
  // Identity
  id: string
  slug: string
  name: string
  description: string
  emoji: string
  primaryColor: string
  secondaryColor: string | null
  logoUrl: string | null
  bannerUrl: string | null
  websiteUrl: string | null

  // Classification
  category: NetworkCategory
  tags: string[]

  // Membership
  membershipType: MembershipType
  requiresValidation: boolean
  maxMembers: number | null
  clientAccess: ClientAccess

  // Points rules
  pointsMultiplier: number
  multiplierMode: MultiplierMode
  coalitionEnabled: boolean
  transferRate: number
  welcomeBonusPoints: number

  // From provider_criteria jsonb
  gamificationEnabled: boolean
  referralEnabled: boolean
  minPointsPerTransaction: number
  maxPointsPerDay: number
  pointsExpirationDays: number

  // Visibility
  isPublic: boolean
  isFeatured: boolean

  // Status
  isActive: boolean
  isDraft: boolean
  status: AdminNetworkStatus

  // Counters
  memberCount: number
  clientCount: number
  createdAt: string
  updatedAt: string

  // Related data
  tiers: NetworkTier[]
  institutionalPartners: InstitutionalPartner[]
}

/** Fields that can be patched (excludes immutable + relational fields). */
export type NetworkConfigPatch = Partial<
  Omit<NetworkConfig, 'id' | 'createdAt' | 'updatedAt' | 'tiers' | 'institutionalPartners' | 'status'>
>

// ─── Create input ─────────────────────────────────────────────────────────────

export interface CreateNetworkInput {
  name: string
  slug: string
  description?: string
  emoji?: string
  primaryColor?: string
  category: NetworkCategory
  tags?: string[]
  multiplier?: number
  isPublic?: boolean
  membershipType?: MembershipType
  requiresValidation?: boolean
}
