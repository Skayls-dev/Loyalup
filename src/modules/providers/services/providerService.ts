import { supabase } from '../../../shared/lib/supabaseClient'
import { requireOnlineForWrite, withCachedRead } from '../../../shared/lib/offlineGuard'

export type ProviderStats = {
  total_clients: number
  total_transactions: number
  total_points_distributed: number
  transactions_today: number
  revenue_today: number
}

export type ProviderConsumedService = {
  service_key: string
  service_id: string | null
  service_nom_libre: string | null
  service_nom: string
  service_emoji: string
  transactions_count: number
  total_amount: number
  total_points: number
}

export type ProviderServiceTopClient = {
  client_id: string
  client_nom: string
  client_email: string
  transactions_count: number
  total_amount: number
  total_points: number
}

export type ProviderConsumptionQueryOptions = {
  periodDays?: number | null
  limit?: number
  serviceNomLibre?: string | null
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
  expiry_date: string | null
  actif: boolean
  reward_delivery_type: 'in_store' | 'digital_code'
  requires_physical_presence: boolean
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
  expiry_date?: string | null
  reward_delivery_type?: 'in_store' | 'digital_code'
  requires_physical_presence?: boolean
}

export type UpdateRewardRuleParams = Partial<Omit<CreateRewardRuleParams, 'fournisseur_id'>>

function formatClientNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? ''
  const normalized = localPart.replace(/[._-]+/g, ' ').trim()
  if (!normalized) {
    return 'Client'
  }

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function resolveClientDisplayName(name: string | null | undefined, email: string | null | undefined, clientId: string): string {
  const trimmedName = (name ?? '').trim()
  const isGenericName = trimmedName.length === 0 || /^client$/i.test(trimmedName)
  if (!isGenericName) {
    return trimmedName
  }

  const trimmedEmail = (email ?? '').trim()
  if (trimmedEmail) {
    return formatClientNameFromEmail(trimmedEmail)
  }

  return `Client ${clientId.slice(0, 6)}`
}

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
            nom: resolveClientDisplayName(profile?.nom as string | undefined, profile?.email as string | undefined, row.client_id),
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

export async function getProviderConsumedServices(
  fournisseur_id: string,
  options: ProviderConsumptionQueryOptions = {},
): Promise<ProviderConsumedService[]> {
  const periodDays = options.periodDays ?? 30
  const limit = options.limit ?? 6

  return withCachedRead(`provider:consumed-services:${fournisseur_id}:${periodDays ?? 'all'}:${limit}`, async () => {
    const windowStart =
      typeof periodDays === 'number'
        ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
        : null

    const [{ data: transactions, error: txError }, { data: services, error: serviceError }] = await Promise.all([
      (windowStart
        ? supabase
            .from('transactions')
            .select('service_id, service_nom_libre, montant, points_credited')
            .eq('fournisseur_id', fournisseur_id)
            .eq('status', 'validated')
            .gte('created_at', windowStart)
        : supabase
            .from('transactions')
            .select('service_id, service_nom_libre, montant, points_credited')
            .eq('fournisseur_id', fournisseur_id)
            .eq('status', 'validated')),
      supabase
        .from('services')
        .select('id, nom, emoji')
        .eq('fournisseur_id', fournisseur_id),
    ])

    if (txError) {
      throw new Error(txError.message)
    }

    if (serviceError) {
      throw new Error(serviceError.message)
    }

    const serviceMap = new Map(
      ((services ?? []) as Array<{ id: string; nom: string; emoji: string | null }>).map((service) => [
        service.id,
        service,
      ]),
    )

    const grouped = new Map<string, ProviderConsumedService>()
    const rows = (transactions ?? []) as Array<{
      service_id: string | null
      service_nom_libre: string | null
      montant: number | null
      points_credited: number | null
    }>

    for (const row of rows) {
      const freeLabel = (row.service_nom_libre ?? '').trim()
      const key = row.service_id ?? `__free_amount__:${freeLabel || 'Montant libre'}`
      const service = row.service_id ? serviceMap.get(row.service_id) : null

      const current = grouped.get(key) ?? {
        service_key: key,
        service_id: row.service_id,
        service_nom_libre: row.service_id ? null : freeLabel || null,
        service_nom: service?.nom?.trim() || freeLabel || 'Montant libre',
        service_emoji: service?.emoji?.trim() || '✨',
        transactions_count: 0,
        total_amount: 0,
        total_points: 0,
      }

      current.transactions_count += 1
      current.total_amount += Number(row.montant ?? 0)
      current.total_points += Number(row.points_credited ?? 0)

      grouped.set(key, current)
    }

    return Array.from(grouped.values())
      .sort((a, b) => {
        if (b.transactions_count !== a.transactions_count) {
          return b.transactions_count - a.transactions_count
        }

        return b.total_amount - a.total_amount
      })
      .slice(0, Math.max(1, limit))
  })
}

export async function getProviderTopClientsByService(
  fournisseur_id: string,
  service_id: string | null,
  options: ProviderConsumptionQueryOptions = {},
): Promise<ProviderServiceTopClient[]> {
  const periodDays = options.periodDays ?? 30
  const limit = options.limit ?? 5
  const serviceNomLibre = options.serviceNomLibre?.trim() || null

  return withCachedRead(
    `provider:service-top-clients:${fournisseur_id}:${service_id ?? 'free-amount'}:${serviceNomLibre ?? 'all-free-labels'}:${periodDays ?? 'all'}:${limit}`,
    async () => {
      const windowStart =
        typeof periodDays === 'number'
          ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
          : null

      let query = supabase
        .from('transactions')
        .select('client_id, montant, points_credited')
        .eq('fournisseur_id', fournisseur_id)
        .eq('status', 'validated')

      query = service_id ? query.eq('service_id', service_id) : query.is('service_id', null)
      if (!service_id && serviceNomLibre) {
        query = query.eq('service_nom_libre', serviceNomLibre)
      }

      if (windowStart) {
        query = query.gte('created_at', windowStart)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(error.message)
      }

      const rows = (data ?? []) as Array<{
        client_id: string
        montant: number | null
        points_credited: number | null
      }>

      if (rows.length === 0) {
        return []
      }

      const grouped = new Map<string, ProviderServiceTopClient>()

      for (const row of rows) {
        const current = grouped.get(row.client_id) ?? {
          client_id: row.client_id,
          client_nom: 'Client',
          client_email: '',
          transactions_count: 0,
          total_amount: 0,
          total_points: 0,
        }

        current.transactions_count += 1
        current.total_amount += Number(row.montant ?? 0)
        current.total_points += Number(row.points_credited ?? 0)
        grouped.set(row.client_id, current)
      }

      const clientIds = [...grouped.keys()]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nom, email')
        .in('id', clientIds)

      const profileMap = new Map((profilesData ?? []).map((profile) => [profile.id as string, profile]))

      const ranked = Array.from(grouped.values()).map((item) => {
        const profile = profileMap.get(item.client_id)
        return {
          ...item,
          client_nom: resolveClientDisplayName(
            profile?.nom as string | undefined,
            profile?.email as string | undefined,
            item.client_id,
          ),
          client_email: (profile?.email as string | undefined) ?? '',
        }
      })

      return ranked
        .sort((a, b) => {
          if (b.transactions_count !== a.transactions_count) {
            return b.transactions_count - a.transactions_count
          }

          return b.total_amount - a.total_amount
        })
        .slice(0, Math.max(1, limit))
    },
  )
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
      .select('id, fournisseur_id, nom, description, points_required, emoji, expiry_date, actif, reward_delivery_type, requires_physical_presence, created_at')
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
      expiry_date: params.expiry_date ?? null,
      ...(params.reward_delivery_type ? { reward_delivery_type: params.reward_delivery_type } : {}),
      requires_physical_presence: params.requires_physical_presence ?? true,
      actif: true,
    })
    .select('id, fournisseur_id, nom, description, points_required, emoji, expiry_date, actif, reward_delivery_type, requires_physical_presence, created_at')
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
    .select('id, fournisseur_id, nom, description, points_required, emoji, expiry_date, actif, reward_delivery_type, requires_physical_presence, created_at')
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
    .select('id, fournisseur_id, nom, description, points_required, emoji, expiry_date, actif, reward_delivery_type, requires_physical_presence, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as RewardRuleItem
}

export async function deleteRewardRule(id: string): Promise<void> {
  requireOnlineForWrite()

  const { error } = await supabase
    .from('reward_rules')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}
