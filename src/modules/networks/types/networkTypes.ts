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

export type NetworkMembershipType = 'open' | 'validated' | 'invite_only'

export type ClientAccessType = 'open' | 'invite' | 'level_required' | 'provider_only'

export type Network = {
  id: string
  slug: string
  name: Record<string, string>
  description?: Record<string, string> | null
  tagline?: Record<string, string> | null
  emoji: string
  primary_color: string
  secondary_color?: string | null
  category: NetworkCategory
  tags: string[]
  points_multiplier: number
  membership_type: NetworkMembershipType
  coalition_enabled: boolean
  transfer_rate: number
  platform_fee_pct: number
  welcome_bonus_points: number
  client_access: ClientAccessType
  min_level_required: number
  is_public: boolean
  is_featured: boolean
  show_member_map?: boolean
  show_leaderboard?: boolean
  is_active: boolean
  is_draft: boolean
  member_count: number
  client_count: number
  created_at: string
  updated_at: string
}

export type NetworkFilters = {
  category?: NetworkCategory
  country?: string
  hasCoalition?: boolean
  featured?: boolean
}

export type NetworkMember = {
  fournisseur_id: string
  provider_name: string
  provider_logo_url?: string | null
  category?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  client_count: number
}

export type NetworkAnnouncement = {
  id: string
  network_id: string
  title: Record<string, string>
  content: Record<string, string>
  emoji?: string | null
  image_url?: string | null
  cta_label?: Record<string, string> | null
  cta_url?: string | null
  is_pinned: boolean
  published_at: string
  expires_at?: string | null
  created_at: string
}

export type NetworkWithEligibility = Network & {
  is_member: boolean
  eligibility?: {
    eligible: boolean
    reason: string | null
    linked_provider_count: number
    current_level: number
    min_level_required: number
  }
}

export type NetworkStats = {
  member_count: number
  client_count: number
  total_bonus_points_distributed: number
  total_transactions_with_bonus: number
  avg_bonus_per_transaction: number
  top_providers_by_clients: Array<{
    fournisseur_id: string
    provider_name: string
    address: string | null
  }>
  client_growth_last_30d: number
  most_active_countries: Array<{ country: string; count: number }>
}

export type NetworkLeaderboardEntry = {
  rank: number
  client_id: string
  client_name: string
  score: number
  is_current_user: boolean
}
