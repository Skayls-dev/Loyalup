import { supabase } from '../../../shared/lib/supabaseClient'
import { requireOnlineForWrite, withCachedRead } from '../../../shared/lib/offlineGuard'

export type ProviderStats = {
  total_clients: number
  total_transactions: number
  total_points_distributed: number
  transactions_today: number
  revenue_today: number
}

export type ProviderClient = {
  profile: {
    id: string
    nom: string
    email: string
  }
  solde: number
  total_visites: number
  last_visit: string | null
}

export type ProviderRecentTransaction = {
  id: string
  created_at: string
  montant: number
  points_credited: number
  client: {
    id: string
    nom: string
    email: string
  }
  service: {
    id: string | null
    nom: string
    emoji: string
  }
}

export type ServiceItem = {
  id: string
  fournisseur_id: string
  nom: string
  emoji: string
  prix_defaut: number | null
  points_defaut: number | null
  points_per_euro: number
  actif: boolean
  created_at: string
}

export type RewardRuleItem = {
  id: string
  fournisseur_id: string
  nom: string
  description: string
  points_required: number
  emoji: string
  actif: boolean
  created_at: string
}

export type CreateServiceParams = {
  fournisseur_id: string
  nom: string
  emoji: string
  prix_defaut?: number | null
  points_defaut?: number | null
  points_per_euro?: number
}

export type UpdateServiceParams = Partial<Omit<CreateServiceParams, 'fournisseur_id'>> & {
  actif?: boolean
}

export type CreateRewardRuleParams = {
  fournisseur_id: string
  nom: string
  description: string
  emoji: string
  points_required: number
}

export type UpdateRewardRuleParams = Partial<Omit<CreateRewardRuleParams, 'fournisseur_id'>>

export async function getProviderStats(fournisseur_id: string): Promise<ProviderStats> {
  return withCachedRead(`provider:stats:${fournisseur_id}`, async () => {
    const { data, error } = await supabase.rpc('get_provider_stats', {
      p_fournisseur_id: fournisseur_id,
    })

    if (error) {
      throw new Error(error.message)
    }

    const row = Array.isArray(data) ? data[0] : data

    return {
      total_clients: Number(row?.total_clients ?? 0),
      total_transactions: Number(row?.total_transactions ?? 0),
      total_points_distributed: Number(row?.total_points_distributed ?? 0),
      transactions_today: Number(row?.transactions_today ?? 0),
      revenue_today: Number(row?.revenue_today ?? 0),
    }
  })
}

export async function getClientList(
  fournisseur_id: string,
  page: number,
  limit: number,
): Promise<ProviderClient[]> {
  return withCachedRead(`provider:clients:${fournisseur_id}:${page}:${limit}`, async () => {
    const from = page * limit
    const to = from + limit - 1

    const { data, error } = await supabase
      .from('client_points')
      .select('client_id, solde, total_visites')
      .eq('fournisseur_id', fournisseur_id)
      .order('solde', { ascending: false })
      .range(from, to)

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as Array<{
      client_id: string
      solde: number
      total_visites: number
    }>

    if (rows.length === 0) {
      return []
    }

    const clientIds = [...new Set(rows.map(r => r.client_id))]

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, nom, email')
      .in('id', clientIds)

    const profileMap = new Map((profilesData ?? []).map(p => [p.id, p]))

    const mapped = await Promise.all(
      rows.map(async (row) => {
        const profile = profileMap.get(row.client_id)

        const { data: lastTransactionData } = await supabase
          .from('transactions')
          .select('created_at')
          .eq('fournisseur_id', fournisseur_id)
          .eq('client_id', row.client_id)
          .eq('status', 'validated')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          profile: {
            id: profile?.id ?? row.client_id,
            nom: profile?.nom ?? 'Client',
            email: profile?.email ?? '',
          },
          solde: Number(row.solde ?? 0),
          total_visites: Number(row.total_visites ?? 0),
          last_visit: (lastTransactionData?.created_at as string | undefined) ?? null,
        } satisfies ProviderClient
      }),
    )

    return mapped
  })
}

export async function getRecentTransactions(
  fournisseur_id: string,
  limit = 10,
): Promise<ProviderRecentTransaction[]> {
  return withCachedRead(`provider:recent:${fournisseur_id}:${limit}`, async () => {
    const { data, error } = await supabase
    .from('transactions')
    .select('id, created_at, montant, points_credited, client_id, service_id')
    .eq('fournisseur_id', fournisseur_id)
    .eq('status', 'validated')
    .order('created_at', { ascending: false })
    .limit(limit)

    if (error) {
      throw new Error(error.message)
    }

    const rows = (data ?? []) as Array<{
    id: string
    created_at: string
    montant: number
    points_credited: number
    client_id: string
    service_id: string | null
  }>

    const result = await Promise.all(
    rows.map(async (row) => {
      const [{ data: profile }, { data: service }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, nom, email')
          .eq('id', row.client_id)
          .maybeSingle(),
        row.service_id
          ? supabase
              .from('services')
              .select('id, nom, emoji')
              .eq('id', row.service_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      return {
        id: row.id,
        created_at: row.created_at,
        montant: Number(row.montant ?? 0),
        points_credited: Number(row.points_credited ?? 0),
        client: {
          id: (profile?.id as string | undefined) ?? row.client_id,
          nom: (profile?.nom as string | undefined) ?? 'Client',
          email: (profile?.email as string | undefined) ?? '',
        },
        service: {
          id: (service?.id as string | undefined) ?? null,
          nom: (service?.nom as string | undefined) ?? 'Service',
          emoji: (service?.emoji as string | undefined) ?? '✨',
        },
      } satisfies ProviderRecentTransaction
    }),
  )

    return result
  })
}

export async function getProviderServices(fournisseur_id: string): Promise<ServiceItem[]> {
  return withCachedRead(`provider:services:${fournisseur_id}`, async () => {
    const { data, error } = await supabase
      .from('services')
      .select('id, fournisseur_id, nom, emoji, prix_defaut, points_defaut, points_per_euro, actif, created_at')
      .eq('fournisseur_id', fournisseur_id)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []) as ServiceItem[]
  })
}

export async function createService(params: CreateServiceParams): Promise<ServiceItem> {
  requireOnlineForWrite()

  const { data, error } = await supabase
    .from('services')
    .insert({
      fournisseur_id: params.fournisseur_id,
      nom: params.nom,
      emoji: params.emoji,
      prix_defaut: params.prix_defaut ?? null,
      points_defaut: params.points_defaut ?? null,
      points_per_euro: params.points_per_euro ?? 10,
      actif: true,
    })
    .select('id, fournisseur_id, nom, emoji, prix_defaut, points_defaut, points_per_euro, actif, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as ServiceItem
}

export async function updateService(id: string, updates: UpdateServiceParams): Promise<ServiceItem> {
  requireOnlineForWrite()

  const { data, error } = await supabase
    .from('services')
    .update(updates)
    .eq('id', id)
    .select('id, fournisseur_id, nom, emoji, prix_defaut, points_defaut, points_per_euro, actif, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as ServiceItem
}

export async function toggleService(id: string, actif: boolean): Promise<ServiceItem> {
  return updateService(id, { actif })
}

export async function getRewardRules(fournisseur_id: string): Promise<RewardRuleItem[]> {
  return withCachedRead(`provider:reward-rules:${fournisseur_id}`, async () => {
    const { data, error } = await supabase
      .from('reward_rules')
      .select('id, fournisseur_id, nom, description, points_required, emoji, actif, created_at')
      .eq('fournisseur_id', fournisseur_id)
      .order('points_required', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []) as RewardRuleItem[]
  })
}

export async function createRewardRule(params: CreateRewardRuleParams): Promise<RewardRuleItem> {
  requireOnlineForWrite()

  const { data, error } = await supabase
    .from('reward_rules')
    .insert({
      fournisseur_id: params.fournisseur_id,
      nom: params.nom,
      description: params.description,
      emoji: params.emoji,
      points_required: params.points_required,
      actif: true,
    })
    .select('id, fournisseur_id, nom, description, points_required, emoji, actif, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as RewardRuleItem
}

export async function updateRewardRule(id: string, updates: UpdateRewardRuleParams): Promise<RewardRuleItem> {
  requireOnlineForWrite()

  const { data, error } = await supabase
    .from('reward_rules')
    .update(updates)
    .eq('id', id)
    .select('id, fournisseur_id, nom, description, points_required, emoji, actif, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as RewardRuleItem
}

export async function toggleRewardRule(id: string, actif: boolean): Promise<RewardRuleItem> {
  requireOnlineForWrite()

  const { data, error } = await supabase
    .from('reward_rules')
    .update({ actif })
    .eq('id', id)
    .select('id, fournisseur_id, nom, description, points_required, emoji, actif, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as RewardRuleItem
}
