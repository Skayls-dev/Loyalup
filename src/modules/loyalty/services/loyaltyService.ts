import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../shared/lib/supabaseClient'
import { config } from '../../../shared/lib/env'
import { requireOnlineForWrite, withCachedRead } from '../../../shared/lib/offlineGuard'

function isTokenAboutToExpire(token: string, bufferSeconds = 60): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = typeof payload?.exp === 'number' ? payload.exp : 0
    return exp - Math.floor(Date.now() / 1000) < bufferSeconds
  } catch {
    return true
  }
}

async function getAccessTokenOrThrow(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)

  let token = data.session?.access_token
  if (!token) throw new Error('Session expirée, reconnectez-vous.')

  if (isTokenAboutToExpire(token)) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed.session?.access_token) {
      token = refreshed.session.access_token
    }
  }

  return token
}

async function ensureFreshSessionForRead(): Promise<void> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(error.message)
  }

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Session expirée, reconnectez-vous.')
  }

  if (isTokenAboutToExpire(token)) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      throw new Error(refreshError.message)
    }
  }
}

export type LoyaltyProvider = {
  id: string
  nom_commerce: string
  adresse: string
}

export type LoyaltyCardBase = {
  fournisseur: LoyaltyProvider
  solde: number
  total_visites: number
  updated_at: string
}

export type TransactionHistoryItem = {
  id: string
  fournisseur_id: string
  service_id: string | null
  service_nom: string
  service_emoji: string
  fournisseur_nom: string
  montant: number
  points_credited: number
  created_at: string
}

export type RewardRule = {
  id: string
  fournisseur_id: string
  nom: string
  description: string
  points_required: number
  emoji: string
  expiry_date: string | null
  actif: boolean
  reward_delivery_type: 'in_store' | 'digital_code'
  requires_physical_presence: boolean
  created_at: string
}

export type ClientReward = {
  id: string
  client_id: string
  fournisseur_id: string
  reward_rule_id: string
  status: 'available' | 'used' | 'expired'
  unlocked_at: string
  used_at: string | null
  created_at: string
  reward_rule: RewardRule
}

export type RewardCatalogItem = {
  id: string
  fournisseur_id: string
  fournisseur_nom: string
  status: 'available' | 'locked'
  unlocked_reward_id: string | null
  unlocked_at: string | null
  current_points: number
  points_needed: number
  reward_rule: RewardRule
}

export type UseRewardResponse = {
  success: boolean
  points_deducted: number
  new_balance: number
}

export type PartnerBalanceResponse = {
  partner_balance: number
  partner_balances_by_provider?: Array<{
    fournisseur_id: string
    balance: number
  }>
  updated_at: string | null
}

type PointsCallback = (nextSolde: number) => void
type RewardsCallback = (reward: ClientReward) => void

export async function getClientCards(client_id: string): Promise<LoyaltyCardBase[]> {
  return withCachedRead(`loyalty:cards:${client_id}`, async () => {
    const { data, error } = await supabase
      .from('client_points')
      .select('fournisseur_id, solde, total_visites, updated_at')
      .eq('client_id', client_id)
      .order('updated_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as Array<{
      fournisseur_id: string
      solde: number
      total_visites: number
      updated_at: string
    }>

    const providerIds = [...new Set(rows.map((row) => row.fournisseur_id))]

    const providerMap = new Map<string, LoyaltyProvider>()

    if (providerIds.length > 0) {
      const { data: providersData, error: providersError } = await supabase
        .from('fournisseurs')
        .select('id, nom_commerce, adresse')
        .in('id', providerIds)

      if (providersError) {
        throw new Error(providersError.message)
      }

      for (const provider of (providersData ?? []) as LoyaltyProvider[]) {
        providerMap.set(provider.id, provider)
      }
    }

    return rows
      .map((row) => {
        const fournisseur = providerMap.get(row.fournisseur_id) ?? null
        if (!fournisseur) {
          return null
        }

        return {
          fournisseur,
          solde: Number(row.solde ?? 0),
          total_visites: Number(row.total_visites ?? 0),
          updated_at: String(row.updated_at ?? new Date().toISOString()),
        } satisfies LoyaltyCardBase
      })
      .filter((row): row is LoyaltyCardBase => row !== null)
  })
}

export async function getTransactionHistory(
  client_id: string,
  fournisseur_id: string | undefined,
  page: number,
  limit: number,
): Promise<TransactionHistoryItem[]> {
  return withCachedRead(`loyalty:history:${client_id}:${fournisseur_id ?? 'all'}:${page}:${limit}`, async () => {
    await ensureFreshSessionForRead()

    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('transactions')
      .select('id, fournisseur_id, service_id, montant, points_credited, created_at')
      .eq('client_id', client_id)
      .eq('status', 'validated')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (fournisseur_id) {
      query = query.eq('fournisseur_id', fournisseur_id)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    const rows = data ?? []
    const serviceIds = [...new Set(rows.filter(r => r.service_id).map(r => r.service_id!))]
    const providerIds = [...new Set(rows.map(r => r.fournisseur_id))]

    const [servicesRes, providersRes] = await Promise.all([
      serviceIds.length > 0 
        ? supabase.from('services').select('id, nom, emoji').in('id', serviceIds) 
        : Promise.resolve({ data: [] }),
      providerIds.length > 0 
        ? supabase.from('fournisseurs').select('id, nom_commerce').in('id', providerIds) 
        : Promise.resolve({ data: [] }),
    ])

    const serviceMap = new Map((servicesRes.data ?? []).map(s => [s.id, s]))
    const providerMap = new Map((providersRes.data ?? []).map(p => [p.id, p]))

    return rows.map((row) => {
      const service = row.service_id ? serviceMap.get(row.service_id) : null
      const provider = providerMap.get(row.fournisseur_id)

      return {
        id: String(row.id),
        fournisseur_id: String(row.fournisseur_id),
        service_id: row.service_id ? String(row.service_id) : null,
        service_nom: service?.nom?.trim() || 'Visite',
        service_emoji: service?.emoji?.trim() || '✨',
        fournisseur_nom: provider?.nom_commerce?.trim() || 'Commerce',
        montant: Number(row.montant ?? 0),
        points_credited: Number(row.points_credited ?? 0),
        created_at: String(row.created_at),
      }
    })
  })
}

export async function getAvailableRewards(
  client_id: string,
  fournisseur_id?: string,
): Promise<ClientReward[]> {
  return withCachedRead(`loyalty:rewards:${client_id}:${fournisseur_id ?? 'all'}`, async () => {
    let query = supabase
      .from('client_rewards')
      .select(
        'id, client_id, fournisseur_id, reward_rule_id, status, unlocked_at, used_at, created_at, reward_rule:reward_rules(id, fournisseur_id, nom, description, points_required, emoji, expiry_date, actif, reward_delivery_type, requires_physical_presence, created_at)',
      )
      .eq('client_id', client_id)
      .eq('status', 'available')
      .order('unlocked_at', { ascending: false })

    if (fournisseur_id) {
      query = query.eq('fournisseur_id', fournisseur_id)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? [])
      .map((row) => {
      const rewardRuleRaw = row.reward_rule as unknown
      const rewardRule = Array.isArray(rewardRuleRaw)
        ? (rewardRuleRaw[0] as RewardRule | undefined) ?? null
        : (rewardRuleRaw as RewardRule | null)
      if (!rewardRule) {
        return null
      }

      return {
        id: String(row.id),
        client_id: String(row.client_id),
        fournisseur_id: String(row.fournisseur_id),
        reward_rule_id: String(row.reward_rule_id),
        status: row.status as ClientReward['status'],
        unlocked_at: String(row.unlocked_at),
        used_at: row.used_at ? String(row.used_at) : null,
        created_at: String(row.created_at),
        reward_rule: {
          ...rewardRule,
          points_required: Number(rewardRule.points_required),
          actif: Boolean(rewardRule.actif),
          reward_delivery_type: (rewardRule.reward_delivery_type === 'digital_code' ? 'digital_code' : 'in_store') as 'in_store' | 'digital_code',
          requires_physical_presence: Boolean(rewardRule.requires_physical_presence),
        },
      } satisfies ClientReward
      })
      .filter((row): row is ClientReward => row !== null)
  })
}

export async function getRewardCatalog(
  client_id: string,
  fournisseur_id?: string,
): Promise<RewardCatalogItem[]> {
  return withCachedRead(`loyalty:reward-catalog:${client_id}:${fournisseur_id ?? 'all'}`, async () => {
    let pointsQuery = supabase
      .from('client_points')
      .select('fournisseur_id, solde')
      .eq('client_id', client_id)

    let availableRewardsQuery = supabase
      .from('client_rewards')
      .select('id, fournisseur_id, reward_rule_id, status, unlocked_at')
      .eq('client_id', client_id)
      .eq('status', 'available')

    if (fournisseur_id) {
      pointsQuery = pointsQuery.eq('fournisseur_id', fournisseur_id)
      availableRewardsQuery = availableRewardsQuery.eq('fournisseur_id', fournisseur_id)
    }

    const [{ data: pointsRows, error: pointsError }, { data: availableRewardsRows, error: availableRewardsError }] = await Promise.all([
      pointsQuery,
      availableRewardsQuery,
    ])

    if (pointsError) {
      throw new Error(pointsError.message)
    }

    if (availableRewardsError) {
      throw new Error(availableRewardsError.message)
    }

    const providerIds = [...new Set([
      ...((pointsRows ?? []) as Array<{ fournisseur_id: string }>).map((row) => row.fournisseur_id),
      ...((availableRewardsRows ?? []) as Array<{ fournisseur_id: string }>).map((row) => row.fournisseur_id),
    ])]

    if (providerIds.length === 0) {
      return []
    }

    const [providersRes, rewardRulesRes] = await Promise.all([
      supabase
        .from('fournisseurs')
        .select('id, nom_commerce')
        .in('id', providerIds),
      supabase
        .from('reward_rules')
        .select('id, fournisseur_id, nom, description, points_required, emoji, expiry_date, actif, reward_delivery_type, requires_physical_presence, created_at')
        .in('fournisseur_id', providerIds)
        .eq('actif', true)
        .or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString().slice(0, 10))
        .order('points_required', { ascending: true }),
    ])

    if (providersRes.error) {
      throw new Error(providersRes.error.message)
    }

    if (rewardRulesRes.error) {
      throw new Error(rewardRulesRes.error.message)
    }

    const providerNames = new Map<string, string>()
    for (const provider of (providersRes.data ?? []) as Array<{ id: string; nom_commerce?: string | null }>) {
      providerNames.set(provider.id, provider.nom_commerce?.trim() || 'Marchand')
    }

    const pointsByProvider = new Map<string, number>()
    for (const row of (pointsRows ?? []) as Array<{ fournisseur_id: string; solde: number | null }>) {
      pointsByProvider.set(row.fournisseur_id, Number(row.solde ?? 0))
    }

    const availableByRule = new Map<string, { id: string; unlocked_at: string | null }>()
    for (const row of (availableRewardsRows ?? []) as Array<{ id: string; reward_rule_id: string; unlocked_at: string | null }>) {
      const existing = availableByRule.get(row.reward_rule_id)
      if (!existing || (existing.unlocked_at ?? '') < (row.unlocked_at ?? '')) {
        availableByRule.set(row.reward_rule_id, {
          id: row.id,
          unlocked_at: row.unlocked_at ?? null,
        })
      }
    }

    return ((rewardRulesRes.data ?? []) as RewardRule[])
      .map((rule) => {
        const currentPoints = Number(pointsByProvider.get(rule.fournisseur_id) ?? 0)
        const availableReward = availableByRule.get(rule.id) ?? null

        return {
          id: rule.id,
          fournisseur_id: rule.fournisseur_id,
          fournisseur_nom: providerNames.get(rule.fournisseur_id) ?? 'Marchand',
          status: availableReward ? 'available' : 'locked',
          unlocked_reward_id: availableReward?.id ?? null,
          unlocked_at: availableReward?.unlocked_at ?? null,
          current_points: currentPoints,
          points_needed: Math.max(0, Number(rule.points_required ?? 0) - currentPoints),
          reward_rule: {
            ...rule,
            points_required: Number(rule.points_required),
            actif: Boolean(rule.actif),
            reward_delivery_type: (rule.reward_delivery_type === 'digital_code' ? 'digital_code' : 'in_store') as 'in_store' | 'digital_code',
            requires_physical_presence: Boolean(rule.requires_physical_presence),
          },
        } satisfies RewardCatalogItem
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'available' ? -1 : 1
        }

        if (a.points_needed !== b.points_needed) {
          return a.points_needed - b.points_needed
        }

        return a.reward_rule.points_required - b.reward_rule.points_required
      })
  })
}

export type UsedRewardItem = {
  id: string
  fournisseur_id: string
  fournisseur_nom: string
  used_at: string
  reward_rule: Pick<RewardRule, 'nom' | 'emoji' | 'points_required'>
}

export async function getUsedRewards(
  client_id: string,
  fournisseur_id?: string,
): Promise<UsedRewardItem[]> {
  let query = supabase
    .from('client_rewards')
    .select('id, fournisseur_id, used_at, reward_rules(nom, emoji, points_required)')
    .eq('client_id', client_id)
    .eq('status', 'used')
    .order('used_at', { ascending: false })
    .limit(50)

  if (fournisseur_id) {
    query = query.eq('fournisseur_id', fournisseur_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = data ?? []
  const providerIds = [...new Set(rows.map((r) => String(r.fournisseur_id)))]

  const { data: providersData } = providerIds.length > 0
    ? await supabase.from('fournisseurs').select('id, nom_commerce').in('id', providerIds)
    : { data: [] }

  const providerMap = new Map((providersData ?? []).map((p) => [p.id, p.nom_commerce as string]))

  return rows
    .map((row) => {
      const ruleRaw = row.reward_rules as unknown
      const rule = Array.isArray(ruleRaw) ? ruleRaw[0] ?? null : ruleRaw as { nom?: string; emoji?: string; points_required?: number } | null
      if (!rule || !row.used_at) return null

      return {
        id: String(row.id),
        fournisseur_id: String(row.fournisseur_id),
        fournisseur_nom: providerMap.get(String(row.fournisseur_id)) ?? 'Marchand',
        used_at: String(row.used_at),
        reward_rule: {
          nom: (rule.nom as string | undefined)?.trim() || 'Récompense',
          emoji: (rule.emoji as string | undefined)?.trim() || '🎁',
          points_required: Number(rule.points_required ?? 0),
        },
      } satisfies UsedRewardItem
    })
    .filter((r): r is UsedRewardItem => r !== null)
}

export async function getRewardRules(fournisseur_id: string): Promise<RewardRule[]> {
  return withCachedRead(`loyalty:reward-rules:${fournisseur_id}`, async () => {
    const { data, error } = await supabase
      .from('reward_rules')
      .select('id, fournisseur_id, nom, description, points_required, emoji, expiry_date, actif, reward_delivery_type, requires_physical_presence, created_at')
      .eq('fournisseur_id', fournisseur_id)
      .eq('actif', true)
      .or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString().slice(0, 10))
      .order('points_required', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return ((data ?? []) as RewardRule[]).map((row) => ({
      ...row,
      points_required: Number(row.points_required),
      actif: Boolean(row.actif),
      reward_delivery_type: (row.reward_delivery_type === 'digital_code' ? 'digital_code' : 'in_store') as 'in_store' | 'digital_code',
      requires_physical_presence: Boolean(row.requires_physical_presence),
    }))
  })
}

export async function useReward(
  client_reward_id: string,
  pending_transaction_id?: string,
): Promise<UseRewardResponse> {
  requireOnlineForWrite()

  let accessToken = await resolveAccessToken()
  if (!accessToken) {
    throw new Error('Vous devez être connecté pour utiliser une récompense.')
  }

  if (import.meta.env.MODE === 'test') {
    const { data, error } = await supabase.functions.invoke<UseRewardResponse>('unlock-reward', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        client_reward_id,
        access_token: accessToken,
        ...(pending_transaction_id ? { pending_transaction_id } : {}),
      },
    })

    if (error) {
      throw new Error(error.message)
    }

    if (!data?.success || typeof data.points_deducted !== 'number' || typeof data.new_balance !== 'number') {
      throw new Error('Invalid unlock reward response')
    }

    return data
  }

  const invokeOnce = async (token: string): Promise<UseRewardResponse> => {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/unlock-reward`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_reward_id,
        access_token: token,
        ...(pending_transaction_id ? { pending_transaction_id } : {}),
      }),
    })

    if (!response.ok) {
      let message = `HTTP ${response.status}`
      try {
        const payload = (await response.json()) as { error?: unknown; message?: unknown }
        if (typeof payload.error === 'string' && payload.error.trim()) {
          message = payload.error.trim()
        } else if (typeof payload.message === 'string' && payload.message.trim()) {
          message = payload.message.trim()
        }
      } catch {
      }
      throw new Error(message)
    }

    return await response.json() as UseRewardResponse
  }

  let data: UseRewardResponse
  try {
    data = await invokeOnce(accessToken)
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError)
    const authFailure = /401|authorization|invalid jwt|unauthorized/i.test(message)
    if (!authFailure) {
      throw caughtError
    }

    accessToken = await resolveAccessToken()
    if (!accessToken) {
      throw new Error('Vous devez être connecté pour utiliser une récompense.')
    }
    data = await invokeOnce(accessToken)
  }

  if (!data?.success || typeof data.points_deducted !== 'number' || typeof data.new_balance !== 'number') {
    throw new Error('Invalid unlock reward response')
  }

  return data
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
    // getUser may have refreshed the session under the hood; return the freshest token.
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

export async function getClientPointsBalance(client_id: string, fournisseur_id: string): Promise<number> {
  return withCachedRead(`loyalty:points-balance:${client_id}:${fournisseur_id}`, async () => {
    const { data, error } = await supabase
      .from('client_points')
      .select('solde')
      .eq('client_id', client_id)
      .eq('fournisseur_id', fournisseur_id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    return Number(data?.solde ?? 0)
  })
}

export async function getClientPartnerBalance(client_id: string): Promise<PartnerBalanceResponse> {
  return withCachedRead(`loyalty:partner-wallet:${client_id}`, async () => {
    const accessToken = await getAccessTokenOrThrow()
    const url = `${config.supabaseUrl}/functions/v1/get-client-partner-balance`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: config.supabaseAnonKey,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      throw new Error(`get-client-partner-balance: HTTP ${response.status}`)
    }

    const data = (await response.json()) as {
      success: boolean
      partner_balance: number
      partner_balances_by_provider?: Array<{ fournisseur_id: string; balance: number }>
      updated_at: string | null
      error?: string
    }

    if (!data || data.success !== true) {
      throw new Error(data?.error ?? 'Invalid partner wallet response')
    }

    return {
      partner_balance: Number(data.partner_balance ?? 0),
      partner_balances_by_provider: (data.partner_balances_by_provider ?? []).map((row) => ({
        fournisseur_id: String(row.fournisseur_id),
        balance: Number(row.balance ?? 0),
      })),
      updated_at: data.updated_at ?? null,
    }
  })
}

export function subscribeToPoints(
  client_id: string,
  fournisseur_id: string,
  callback: PointsCallback,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`loyalty-points-${client_id}-${fournisseur_id}-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'client_points',
        filter: `client_id=eq.${client_id}`,
      },
      (payload) => {
        const row = (payload.new || payload.old) as { fournisseur_id?: string; solde?: number }
        if (row?.fournisseur_id === fournisseur_id) {
          callback(Number(row.solde ?? 0))
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToRewards(client_id: string, callback: RewardsCallback): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`loyalty-rewards-${client_id}-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'client_rewards',
        filter: `client_id=eq.${client_id}`,
      },
      async (payload) => {
        const row = payload.new as {
          id: string
          client_id: string
          fournisseur_id: string
          reward_rule_id: string
          status: ClientReward['status']
          unlocked_at: string
          used_at: string | null
          created_at: string
        }

        if (!row?.id) {
          return
        }

        const { data: rewardRule, error } = await supabase
          .from('reward_rules')
          .select('id, fournisseur_id, nom, description, points_required, emoji, expiry_date, actif, created_at')
          .eq('id', row.reward_rule_id)
          .maybeSingle()

        if (error || !rewardRule) {
          return
        }

        callback({
          ...row,
          reward_rule: {
            ...(rewardRule as RewardRule),
            points_required: Number(rewardRule.points_required),
            actif: Boolean(rewardRule.actif),
          },
        })
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
