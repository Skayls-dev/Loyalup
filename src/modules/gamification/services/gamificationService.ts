import { supabase } from '../../../shared/lib/supabaseClient'

// ============================================================================
// Level & XP
// ============================================================================

export interface ClientLevelData {
  current_level: number
  xp_total: number
  xp_to_next_level: number
  progress_pct: number
  level_name: Record<string, string>
  level_emoji: string
  level_color: string
  perks: Array<{ description: Record<string, string>; type: string; value: number }>
}

type LevelDefinitionRow = {
  level_number: number
  name: Record<string, string>
  emoji: string
  color: string
  min_xp: number
  max_xp: number
  perks: Array<{ description: Record<string, string>; type: string; value: number }> | null
}

async function getLevelDefinition(levelNumber: number): Promise<LevelDefinitionRow> {
  const { data, error } = await supabase
    .from('level_definitions')
    .select('level_number, name, emoji, color, min_xp, max_xp, perks')
    .eq('level_number', levelNumber)
    .maybeSingle()

  if (error || !data) {
    return {
      level_number: 1,
      name: { fr: 'Niveau 1', en: 'Level 1' },
      emoji: '🌱',
      color: '#22c55e',
      min_xp: 0,
      max_xp: 100,
      perks: [],
    }
  }

  return data as LevelDefinitionRow
}

export async function getClientLevel(clientId: string): Promise<ClientLevelData> {
  const { data, error } = await supabase
    .from('client_levels')
    .select(
      `
      xp_total, current_level,
      level_definitions: current_level (
        level_number, name, emoji, color, min_xp, max_xp, perks
      )
    `,
    )
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    await supabase
      .from('client_levels')
      .upsert({ client_id: clientId, current_level: 1, xp_total: 0 }, { onConflict: 'client_id' })

    const levelDef = await getLevelDefinition(1)

    return {
      current_level: levelDef.level_number,
      xp_total: 0,
      xp_to_next_level: Math.max(0, levelDef.max_xp),
      progress_pct: 0,
      level_name: levelDef.name,
      level_emoji: levelDef.emoji,
      level_color: levelDef.color,
      perks: levelDef.perks || [],
    }
  }

  const joinedLevelDef = (data as any).level_definitions
  const levelDef = joinedLevelDef ?? (await getLevelDefinition(data.current_level ?? 1))

  const levelSpan = Math.max(1, levelDef.max_xp - levelDef.min_xp)
  const progressBase = Math.max(0, data.xp_total - levelDef.min_xp)

  return {
    current_level: levelDef.level_number,
    xp_total: data.xp_total,
    xp_to_next_level: Math.max(0, levelDef.max_xp - data.xp_total),
    progress_pct: Math.min(100, Math.round((progressBase / levelSpan) * 100)),
    level_name: levelDef.name,
    level_emoji: levelDef.emoji,
    level_color: levelDef.color,
    perks: levelDef.perks || [],
  }
}

// ============================================================================
// Badges
// ============================================================================

export interface BadgeData {
  id: string
  code: string
  name: Record<string, string>
  emoji: string
  category: string
  rarity: string
  unlocked_at?: string
}

export async function getClientBadges(
  clientId: string,
): Promise<{ earned: BadgeData[]; locked: BadgeData[]; total: number }> {
  const { data: earnedBadges, error: earnedError } = await supabase
    .from('client_badges')
    .select('badge_id, unlocked_at, badge_definitions!inner(id, code, name, emoji, category, rarity)')
    .eq('client_id', clientId)

  if (earnedError) throw earnedError

  const earnedIds = new Set(
    (earnedBadges as any[])?.map((b) => b.badge_definitions.id) ?? [],
  )

  const { data: allBadges, error: allError } = await supabase
    .from('badge_definitions')
    .select('id, code, name, emoji, category, rarity')
    .eq('is_active', true)
    .eq('is_secret', false)

  if (allError) throw allError

  const earned: BadgeData[] = (earnedBadges as any[])?.map((b) => ({
    id: b.badge_definitions.id,
    code: b.badge_definitions.code,
    name: b.badge_definitions.name,
    emoji: b.badge_definitions.emoji,
    category: b.badge_definitions.category,
    rarity: b.badge_definitions.rarity,
    unlocked_at: b.unlocked_at,
  })) ?? []

  const locked: BadgeData[] = (allBadges as any[])
    ?.filter((b) => !earnedIds.has(b.id))
    .map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      emoji: b.emoji,
      category: b.category,
      rarity: b.rarity,
    })) ?? []

  return {
    earned,
    locked,
    total: (allBadges as any[])?.length ?? 0,
  }
}

// ============================================================================
// Challenges
// ============================================================================

export interface ChallengeData {
  id: string
  title: Record<string, string>
  description: Record<string, string>
  emoji: string
  type: string
  target_value: number
  reward_points: number
  reward_xp: number
  current_value: number
  progress_pct: number
  time_remaining_ms: number
  completed: boolean
  ends_at: string
}

export async function getActiveChallenges(clientId: string): Promise<ChallengeData[]> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('challenges')
    .select(
      `
      id, title, description, emoji, type, target_value, reward_points, reward_xp, ends_at,
      client_challenge_progress!inner(current_value, completed)
    `,
    )
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .eq('client_challenge_progress.client_id', clientId)

  if (error) throw error

  return (data as any[])?.map((challenge) => {
    const progress = challenge.client_challenge_progress[0]
    const endsAt = new Date(challenge.ends_at).getTime()
    const now = Date.now()

    return {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      emoji: challenge.emoji,
      type: challenge.type,
      target_value: challenge.target_value,
      reward_points: challenge.reward_points,
      reward_xp: challenge.reward_xp,
      current_value: progress.current_value,
      progress_pct: Math.min(100, Math.round((progress.current_value / challenge.target_value) * 100)),
      time_remaining_ms: Math.max(0, endsAt - now),
      completed: progress.completed,
      ends_at: challenge.ends_at,
    }
  }) ?? []
}

// ============================================================================
// Streaks
// ============================================================================

export interface StreakData {
  current: number
  longest: number
  last_visit: Date | null
  is_at_risk: boolean
}

export async function getClientStreak(clientId: string): Promise<StreakData> {
  const { data, error } = await supabase
    .from('client_streaks')
    .select('current_streak, longest_streak, last_visit_date')
    .eq('client_id', clientId)
    .is('fournisseur_id', null)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return { current: 0, longest: 0, last_visit: null, is_at_risk: false }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const lastVisit = data.last_visit_date ? new Date(data.last_visit_date) : null
  const isAtRisk = Boolean(
    lastVisit &&
      lastVisit < today &&
      (today.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24) >= 1,
  )

  return {
    current: data.current_streak ?? 0,
    longest: data.longest_streak ?? 0,
    last_visit: lastVisit,
    is_at_risk: isAtRisk,
  }
}

// ============================================================================
// Leaderboards
// ============================================================================

export interface LeaderboardEntry {
  rank: number
  client_name: string
  score: number
  is_current_user: boolean
}

export async function getLeaderboard(
  type: 'global_points' | 'global_xp' | 'provider_points' | 'referrals' | 'streak',
  fournisseurId?: string,
  period: string = 'all_time',
): Promise<{ entries: LeaderboardEntry[]; myRank: number | null; myScore: number | null }> {
  let query = supabase
    .from('leaderboard_entries')
    .select('rank, score, client_id')
    .eq('leaderboard_type', type)
    .eq('period', period)
    .order('rank', { ascending: true })
    .limit(50)

  if (fournisseurId) {
    query = query.eq('fournisseur_id', fournisseurId)
  } else {
    query = query.is('fournisseur_id', null)
  }

  const { data, error } = await query

  if (error) throw error

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const entries: LeaderboardEntry[] = ((data ?? []) as Array<{ rank: number; score: number; client_id: string }>).map((entry) => ({
    rank: entry.rank,
    client_name: entry.client_id === user?.id ? 'Vous' : `Utilisateur #${entry.rank}`,
    score: entry.score,
    is_current_user: entry.client_id === user?.id,
  }))

  const myEntry = entries.find((e) => e.is_current_user)

  return {
    entries,
    myRank: myEntry?.rank ?? null,
    myScore: myEntry?.score ?? null,
  }
}

// ============================================================================
// Referrals
// ============================================================================

export interface ReferralStats {
  code: string
  url: string
  expires_at: string
  total_generated: number
  activated: number
  rewarded: number
  points_earned: number
}

type ReferralStatus = 'pending' | 'activated' | 'rewarded' | 'expired'

type ReferralRow = {
  referral_code: string
  expires_at: string
  status: ReferralStatus
  points_awarded_referrer: number
}

function toFriendlyReferralError(status: number, fallback: string, mode: 'generate' | 'activate'): Error {
  if (status === 401 || status === 403) {
    return new Error('Votre session a expire. Reconnectez-vous pour acceder au parrainage.')
  }

  if (mode === 'generate') {
    return new Error(fallback || 'Impossible de generer votre lien de parrainage pour le moment.')
  }

  return new Error(fallback || 'Impossible d\'activer ce code de parrainage.')
}

async function resolveAccessToken(): Promise<string | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    return null
  }

  let accessToken = sessionData.session?.access_token ?? null

  if (!accessToken) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      return null
    }

    accessToken = refreshData.session?.access_token ?? null
  }

  if (!accessToken) {
    return null
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (!userError && userData.user?.id) {
    const { data: latestSessionData, error: latestSessionError } = await supabase.auth.getSession()
    if (!latestSessionError && latestSessionData.session?.access_token) {
      return latestSessionData.session.access_token
    }

    return accessToken
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) {
    return null
  }

  return refreshData.session?.access_token ?? null
}

function getReferralBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return import.meta.env.VITE_APP_URL || 'https://loyalup.app'
}

export async function getReferralStats(): Promise<ReferralStats | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return null
  }

  const { data: latestRows, error: latestError } = await supabase
    .from('client_referrals')
    .select('referral_code, expires_at, status, points_awarded_referrer')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (latestError) {
    throw latestError
  }

  const latest = (latestRows?.[0] as ReferralRow | undefined) ?? null
  if (!latest) {
    return null
  }

  const { data: rows, error: rowsError } = await supabase
    .from('client_referrals')
    .select('status, points_awarded_referrer')
    .eq('referrer_id', user.id)

  if (rowsError) {
    throw rowsError
  }

  const summary = (rows ?? []) as Array<{ status: ReferralStatus; points_awarded_referrer: number }>

  return {
    code: latest.referral_code,
    url: `${getReferralBaseUrl()}/join/${latest.referral_code}`,
    expires_at: latest.expires_at,
    total_generated: summary.length,
    activated: summary.filter((row) => row.status === 'activated' || row.status === 'rewarded').length,
    rewarded: summary.filter((row) => row.status === 'rewarded').length,
    points_earned: summary.reduce((sum, row) => sum + Number(row.points_awarded_referrer ?? 0), 0),
  }
}

export async function activateReferralByCode(referralCode: string): Promise<{ activated: boolean; message: string }> {
  const accessToken = await resolveAccessToken()

  if (!accessToken) {
    throw new Error('Votre session a expire. Reconnectez-vous pour acceder au parrainage.')
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-referral`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ referral_code: referralCode.trim() }),
    },
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw toFriendlyReferralError(response.status, payload.error || '', 'activate')
  }

  const payload = (await response.json()) as { activated: boolean; message: string }
  return payload
}

export async function generateReferralLink(fournisseurId?: string): Promise<ReferralStats> {
  const accessToken = await resolveAccessToken()

  if (!accessToken) {
    throw new Error('Votre session a expire. Reconnectez-vous pour acceder au parrainage.')
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-referral`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fournisseur_id: fournisseurId }),
    },
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw toFriendlyReferralError(response.status, payload.error || '', 'generate')
  }

  const stats = await getReferralStats()
  if (!stats) {
    const data = (await response.json()) as { referral_code: string; share_url: string; expires_at: string }

    return {
      code: data.referral_code,
      url: data.share_url,
      expires_at: data.expires_at,
      total_generated: 1,
      activated: 0,
      rewarded: 0,
      points_earned: 0,
    }
  }

  return stats
}

// ============================================================================
// Marketplace & Transfers
// ============================================================================

export interface TransferOption {
  to_fournisseur_id: string
  provider_name: string
  estimated_points: number
  conversion_rate: number
  fee_pct: number
}

export async function getTransferOptions(
  from_fournisseur_id: string,
): Promise<TransferOption[]> {
  // Find coalition members for this provider
  const { data: members, error: membersError } = await supabase
    .from('coalition_members')
    .select('coalition_id')
    .eq('fournisseur_id', from_fournisseur_id)
    .eq('status', 'active')

  if (membersError || !members || members.length === 0) return []

  const coalitionId = (members as any[])[0].coalition_id

  // Find other members in same coalition
  const { data: otherMembers, error: otherError } = await supabase
    .from('coalition_members')
    .select('fournisseur_id, provider_coalitions!inner(conversion_rate, platform_fee_pct)')
    .eq('coalition_id', coalitionId)
    .eq('status', 'active')
    .neq('fournisseur_id', from_fournisseur_id)

  if (otherError) throw otherError

  // Fetch provider names
  const providerIds = (otherMembers as any[])?.map((m) => m.fournisseur_id) ?? []
  const { data: providers, error: providersError } = await supabase
    .from('fournisseurs')
    .select('id, nom')
    .in('id', providerIds)

  if (providersError) throw providersError

  return (otherMembers as any[]).map((member) => {
    const provider = providers?.find((p: any) => p.id === member.fournisseur_id)
    const coalition = member.provider_coalitions

    return {
      to_fournisseur_id: member.fournisseur_id,
      provider_name: provider?.nom ?? 'Unknown',
      estimated_points: 0, // Will be calculated based on amount
      conversion_rate: coalition.conversion_rate,
      fee_pct: coalition.platform_fee_pct,
    }
  })
}

export async function transferPoints(params: {
  client_id: string
  from_fournisseur_id: string
  to_fournisseur_id: string
  points_to_transfer: number
}): Promise<any> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transfer-points`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    },
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error ?? 'Transfer failed')
  }

  return response.json()
}

// ============================================================================
// Coalitions
// ============================================================================

export async function getCoalitions(): Promise<any[]> {
  const { data, error } = await supabase
    .from('provider_coalitions')
    .select('id, name, description, logo_url, platform_fee_pct')
    .eq('is_active', true)

  if (error) throw error
  return data ?? []
}
