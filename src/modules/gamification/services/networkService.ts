import { supabase } from '../../../shared/lib/supabaseClient'

async function resolveProviderId(providerUserId: string): Promise<string> {
  const { data } = await supabase
    .from('fournisseurs')
    .select('id')
    .eq('user_id', providerUserId)
    .maybeSingle()

  return data?.id ?? providerUserId
}

// ============================================================================
// Provider Coalition Management
// ============================================================================

export interface ProviderCoalition {
  id: string
  name: string
  description?: string
  logo_url?: string
  conversion_rate: number
  platform_fee_pct: number
  is_active: boolean
}

export interface CoalitionMember {
  id: string
  fournisseur_id: string
  coalition_id: string
  status: 'pending' | 'active' | 'suspended' | 'left'
  joined_at: string
  commission_pct?: number
}

export async function getProviderCoalitions(providerUserId: string): Promise<ProviderCoalition[]> {
  const providerId = await resolveProviderId(providerUserId)

  const { data, error } = await supabase
    .from('coalition_members')
    .select('coalition_id, provider_coalitions!inner(id, name, description, logo_url, conversion_rate, platform_fee_pct, is_active)')
    .eq('fournisseur_id', providerId)
    .eq('status', 'active')

  if (error) throw error

  return (data as any[])?.map((m) => m.provider_coalitions) ?? []
}

export async function getCoalitionMembers(
  coalitionId: string,
): Promise<Array<CoalitionMember & { provider_name: string }>> {
  const { data, error } = await supabase
    .from('coalition_members')
    .select('id, fournisseur_id, coalition_id, status, joined_at, fournisseurs(nom)')
    .eq('coalition_id', coalitionId)

  if (error) throw error

  return (data as any[])?.map((m) => ({
    id: m.id,
    fournisseur_id: m.fournisseur_id,
    coalition_id: m.coalition_id,
    status: m.status,
    joined_at: m.joined_at,
    provider_name: m.fournisseurs?.nom ?? 'Unknown',
  })) ?? []
}

export async function getCoalitionStats(coalitionId: string): Promise<{
  total_members: number
  active_members: number
  total_transfers: number
  total_points_transferred: number
  total_platform_fees: number
} | null> {
  const { data, error } = await supabase
    .from('provider_coalitions')
    .select(
      `
      id,
      coalition_members(count),
      point_transfers(count, points_deducted)
    `,
    )
    .eq('id', coalitionId)
    .single()

  if (error) throw error

  const members = (data as any)?.coalition_members ?? []
  const transfers = (data as any)?.point_transfers ?? []

  return {
    total_members: members.length,
    active_members: members.filter((m: any) => m.status === 'active').length,
    total_transfers: transfers.length,
    total_points_transferred: transfers.reduce((sum: number, t: any) => sum + t.points_deducted, 0),
    total_platform_fees: transfers.reduce(
      (sum: number, t: any) => sum + ((t.points_deducted * 0.1) | 0),
      0,
    ),
  }
}

export async function updateCoalitionSettings(coalitionId: string, updates: Partial<ProviderCoalition>): Promise<void> {
  const { error } = await supabase
    .from('provider_coalitions')
    .update({
      name: updates.name,
      description: updates.description,
      logo_url: updates.logo_url,
    })
    .eq('id', coalitionId)

  if (error) throw error
}

export async function suspendCoalitionMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('coalition_members')
    .update({ status: 'suspended' })
    .eq('id', memberId)

  if (error) throw error
}

export async function removeCoalitionMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('coalition_members')
    .update({ status: 'left' })
    .eq('id', memberId)

  if (error) throw error
}

// ============================================================================
// Admin Network Analytics
// ============================================================================

export interface NetworkStats {
  total_clients: number
  active_clients: number
  total_xp_awarded: number
  total_badges_earned: number
  total_points_transferred: number
  total_referrals: number
  referral_conversion_rate: number
  viral_k_factor: number
}

export interface ViralMetrics {
  tier: number
  total_referrers: number
  total_referred: number
  total_rewarded_referrals: number
  avg_reward_per_referrer: number
}

export interface ReferralFunnel {
  step: string
  count: number
  conversion_from_previous: number
}

export interface ProviderReferralStats {
  generated: number
  activated: number
  rewarded: number
}

export async function getNetworkStats(): Promise<NetworkStats> {
  const { count: totalClients } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'client')

  const { count: totalBadges } = await supabase
    .from('client_badges')
    .select('id', { count: 'exact', head: true })

  const { data: xpData } = await supabase
    .from('xp_transactions')
    .select('xp_amount')

  const { data: transferData } = await supabase
    .from('point_transfers')
    .select('points_deducted')

  const { count: totalReferrals } = await supabase
    .from('client_referrals')
    .select('id', { count: 'exact', head: true })
    .in('status', ['activated', 'rewarded'])

  const { count: rewardedReferrals } = await supabase
    .from('client_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'rewarded')

  const { data: referralsRaw } = await supabase
    .from('client_referrals')
    .select('referrer_id, referred_id')
    .in('status', ['activated', 'rewarded'])

  const uniqueReferrers = new Set((referralsRaw ?? []).map((item) => item.referrer_id).filter(Boolean))
  const totalInvites = (referralsRaw ?? []).length
  const activationRate = totalInvites > 0 ? (totalReferrals ?? 0) / totalInvites : 0
  const invitesPerReferrer = uniqueReferrers.size > 0 ? totalInvites / uniqueReferrers.size : 0
  const viralKFactor = Number((invitesPerReferrer * activationRate).toFixed(3))

  const totalXp =
    (xpData as any[])?.reduce((sum: number, row: any) => sum + row.xp_amount, 0) ?? 0

  const totalTransferred =
    (transferData as any[])?.reduce((sum: number, row: any) => sum + row.points_deducted, 0) ?? 0

  return {
    total_clients: totalClients ?? 0,
    active_clients: Math.floor((totalClients ?? 0) * 0.6), // Estimate
    total_xp_awarded: totalXp,
    total_badges_earned: totalBadges ?? 0,
    total_points_transferred: totalTransferred,
    total_referrals: totalReferrals ?? 0,
    referral_conversion_rate: rewardedReferrals && totalReferrals ? (rewardedReferrals / totalReferrals) * 100 : 0,
    viral_k_factor: viralKFactor,
  }
}

export async function getViralMetrics(): Promise<ViralMetrics[]> {
  const { data: allActivated } = await supabase
    .from('client_referrals')
    .select('referrer_id, referred_id, status')
    .in('status', ['activated', 'rewarded'])

  const referrerCounts = new Map<string, number>()
  const referredIds = new Set<string>()

  for (const row of allActivated ?? []) {
    if (row.referrer_id) {
      referrerCounts.set(row.referrer_id, (referrerCounts.get(row.referrer_id) ?? 0) + 1)
    }
    if (row.referred_id) {
      referredIds.add(row.referred_id)
    }
  }

  const { data: secondaryRows } = await supabase
    .from('client_referrals')
    .select('id, referrer_id, status')
    .in('referrer_id', Array.from(referredIds))
    .in('status', ['activated', 'rewarded'])

  const tier1Referrers = referrerCounts.size
  const tier1Referrals = (allActivated ?? []).length
  const tier2Referrals = (secondaryRows ?? []).length
  const tier2Referrers = new Set((secondaryRows ?? []).map((item) => item.referrer_id).filter(Boolean)).size
  const tier2Rewarded = (secondaryRows ?? []).filter((item) => item.status === 'rewarded').length

  return [
    {
      tier: 1,
      total_referrers: tier1Referrers,
      total_referred: tier1Referrals,
      total_rewarded_referrals: (allActivated ?? []).filter((item) => item.status === 'rewarded').length,
      avg_reward_per_referrer: tier1Referrers > 0 ? Math.round((tier1Referrals * 200) / tier1Referrers) : 0,
    },
    {
      tier: 2,
      total_referrers: tier2Referrers,
      total_referred: tier2Referrals,
      total_rewarded_referrals: tier2Rewarded,
      avg_reward_per_referrer: tier2Referrers > 0 ? Math.round((tier2Rewarded * 200) / tier2Referrers) : 0,
    },
  ]
}

export async function getReferralFunnel(): Promise<ReferralFunnel[]> {
  const { count: generated } = await supabase
    .from('client_referrals')
    .select('id', { count: 'exact', head: true })

  const { count: activated } = await supabase
    .from('client_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'activated')

  const { count: rewarded } = await supabase
    .from('client_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'rewarded')

  const generatedCount = generated ?? 0
  const activatedCount = activated ?? 0
  const rewardedCount = rewarded ?? 0

  return [
    {
      step: 'Codes Générés',
      count: generatedCount,
      conversion_from_previous: 100,
    },
    {
      step: 'Codes Activés',
      count: activatedCount,
      conversion_from_previous:
        generatedCount > 0 ? Math.round((activatedCount / generatedCount) * 100) : 0,
    },
    {
      step: 'Récompenses Données',
      count: rewardedCount,
      conversion_from_previous:
        activatedCount > 0 ? Math.round((rewardedCount / activatedCount) * 100) : 0,
    },
  ]
}

export async function getTopReferrers(limit: number = 10): Promise<
  Array<{
    client_id: string
    client_name: string
    referral_count: number
    xp_earned: number
  }>
> {
  const { data, error } = await supabase
    .from('client_referrals')
    .select('referrer_id')
    .in('status', ['activated', 'rewarded'])

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.referrer_id) continue
    counts.set(row.referrer_id, (counts.get(row.referrer_id) ?? 0) + 1)
  }

  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  const topIds = top.map(([id]) => id)
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, prenom, nom')
    .in('id', topIds)

  const nameById = new Map((profilesData ?? []).map((item) => [item.id, `${item.prenom ?? ''} ${item.nom ?? ''}`.trim()]))

  return top.map(([clientId, referralCount]) => ({
    client_id: clientId,
    client_name: nameById.get(clientId) || 'Utilisateur',
    referral_count: referralCount,
    xp_earned: referralCount * 200,
  }))
}

export async function getCoalitionLeaderboard(limit: number = 20): Promise<
  Array<{
    coalition_id: string
    coalition_name: string
    total_members: number
    total_transfers: number
    total_points_transferred: number
  }>
> {
  const { data, error } = await supabase
    .from('provider_coalitions')
    .select(
      `
      id, name,
      coalition_members(count),
      point_transfers(count, points_deducted)
    `,
    )
    .eq('is_active', true)
    .limit(limit)

  if (error) throw error

  return (data as any[])?.map((c) => ({
    coalition_id: c.id,
    coalition_name: c.name,
    total_members: c.coalition_members?.length ?? 0,
    total_transfers: c.point_transfers?.length ?? 0,
    total_points_transferred: (c.point_transfers ?? []).reduce(
      (sum: number, t: any) => sum + t.points_deducted,
      0,
    ),
  })) ?? []
}

export async function generateProviderReferralLink(): Promise<{ referral_code: string; share_url: string }> {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-provider-referral`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to generate provider referral' }))
    throw new Error(err.error ?? 'Failed to generate provider referral')
  }

  const data = await response.json()
  return { referral_code: data.referral_code, share_url: data.share_url }
}

export async function activateProviderReferralCode(referralCode: string): Promise<{ activated: boolean }> {
  const token = (await supabase.auth.getSession()).data.session?.access_token
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-provider-referral`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ referral_code: referralCode }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to activate provider referral' }))
    throw new Error(err.error ?? 'Failed to activate provider referral')
  }

  const data = await response.json()
  return { activated: Boolean(data.activated) }
}

export async function getProviderReferralStats(providerId: string): Promise<ProviderReferralStats> {
  const resolvedProviderId = await resolveProviderId(providerId)

  const { data, error } = await supabase
    .from('provider_referrals')
    .select('status')
    .eq('referrer_id', resolvedProviderId)

  if (error) throw error

  const generated = (data ?? []).length
  const activated = (data ?? []).filter((item) => item.status === 'activated' || item.status === 'rewarded').length
  const rewarded = (data ?? []).filter((item) => item.status === 'rewarded').length
  return { generated, activated, rewarded }
}

export function subscribeReferralRealtime(onChange: () => void): () => void {
  const channel = supabase
    .channel('referrals-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'client_referrals' }, () => onChange())
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
