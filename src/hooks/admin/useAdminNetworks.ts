import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../shared/lib/supabaseClient'
import { showToast } from '../../shared/stores/toastStore'
import type {
  AdminNetworkListItem,
  AdminNetworksListResult,
  AdminNetworksListStats,
  AdminNetworkStatus,
  ClientAccess,
  CreateNetworkInput,
  InstitutionalPartner,
  MembershipType,
  MultiplierMode,
  NetworkCategory,
  NetworkConfig,
  NetworkConfigPatch,
  NetworkTier,
} from '../../types/admin'

// ─── Constants ────────────────────────────────────────────────────────────────

const QK_BASE = ['admin', 'networks'] as const
const STALE_TIME = 30 * 1000

const DEFAULT_TIERS: NetworkTier[] = [
  { label: 'Bronze', minPoints: 0 },
  { label: 'Silver', minPoints: 1000 },
  { label: 'Gold', minPoints: 5000 },
  { label: 'Platinum', minPoints: 10000 },
]

const EMPTY_STATS: AdminNetworksListStats = {
  activeNetworks: 0,
  totalMerchants: 0,
  activeUsers: 0,
  pointsDistributed: 0,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalizedString(raw: unknown, fallback = ''): string {
  if (typeof raw === 'string' && raw.trim()) return raw
  if (raw && typeof raw === 'object') {
    const obj = raw as { fr?: unknown; en?: unknown }
    if (typeof obj.fr === 'string' && obj.fr.trim()) return obj.fr
    if (typeof obj.en === 'string' && obj.en.trim()) return obj.en
  }
  return fallback
}

function resolveStatus(row: { is_active: unknown; is_draft: unknown }): AdminNetworkStatus {
  if (Boolean(row.is_draft)) return 'draft'
  if (Boolean(row.is_active)) return 'active'
  return 'paused'
}

function parseCriteria(raw: unknown): {
  gamificationEnabled: boolean
  referralEnabled: boolean
  minPointsPerTransaction: number
  maxPointsPerDay: number
  pointsExpirationDays: number
} {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    gamificationEnabled: Boolean(obj.gamification_enabled ?? true),
    referralEnabled: Boolean(obj.referral_enabled ?? false),
    minPointsPerTransaction: Number(obj.min_points_per_transaction ?? 0),
    maxPointsPerDay: Number(obj.max_points_per_day ?? 0),
    pointsExpirationDays: Number(obj.points_expiration_days ?? 365),
  }
}

function buildCriteriaDelta(patch: NetworkConfigPatch): Record<string, unknown> {
  const delta: Record<string, unknown> = {}
  if (patch.gamificationEnabled !== undefined) delta.gamification_enabled = patch.gamificationEnabled
  if (patch.referralEnabled !== undefined) delta.referral_enabled = patch.referralEnabled
  if (patch.minPointsPerTransaction !== undefined) delta.min_points_per_transaction = patch.minPointsPerTransaction
  if (patch.maxPointsPerDay !== undefined) delta.max_points_per_day = patch.maxPointsPerDay
  if (patch.pointsExpirationDays !== undefined) delta.points_expiration_days = patch.pointsExpirationDays
  return delta
}

// ─── Network-list row type ────────────────────────────────────────────────────

type NetworkListRow = {
  id: string
  slug: string
  name: unknown
  description: unknown
  emoji: string | null
  primary_color: string | null
  category: string | null
  tags: string[] | null
  points_multiplier: number | null
  is_active: boolean | null
  is_draft: boolean | null
  is_public: boolean | null
  is_featured: boolean | null
  member_count: number | null
  client_count: number | null
  created_at: string
}

// ─── Network-config row type ──────────────────────────────────────────────────

type NetworkConfigRow = {
  id: string
  slug: string
  name: unknown
  description: unknown
  emoji: string | null
  primary_color: string | null
  secondary_color: string | null
  logo_url: string | null
  banner_url: string | null
  website_url: string | null
  category: string | null
  tags: string[] | null
  membership_type: string | null
  requires_validation: boolean | null
  max_members: number | null
  client_access: string | null
  points_multiplier: number | null
  multiplier_mode: string | null
  coalition_enabled: boolean | null
  transfer_rate: number | null
  welcome_bonus_points: number | null
  is_public: boolean | null
  is_featured: boolean | null
  is_active: boolean | null
  is_draft: boolean | null
  provider_criteria: unknown
  member_count: number | null
  client_count: number | null
  created_at: string
  updated_at: string
}

// ─── Fetcher: list ────────────────────────────────────────────────────────────

async function fetchNetworksList(): Promise<AdminNetworksListResult> {
  const { data, error } = await supabase
    .from('networks')
    .select(
      'id, slug, name, description, emoji, primary_color, category, tags, points_multiplier, is_active, is_draft, is_public, is_featured, member_count, client_count, created_at',
    )
    .order('is_featured', { ascending: false })
    .order('member_count', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as NetworkListRow[]
  const ids = rows.map((r) => r.id)

  const merchantMap = new Map<string, number>()
  const pointsMap = new Map<string, number>()
  const retentionMap = new Map<string, number>()

  if (ids.length) {
    const [memberRes, pointsRes, clientRes] = await Promise.all([
      supabase
        .from('network_members')
        .select('network_id')
        .in('network_id', ids)
        .eq('status', 'active'),
      supabase
        .from('network_point_events')
        .select('network_id, base_points, bonus_points')
        .in('network_id', ids)
        .gte('created_at', new Date(Date.now() - 86400 * 1000).toISOString()),
      supabase
        .from('network_clients')
        .select('network_id, last_activity_at')
        .in('network_id', ids),
    ])

    for (const row of (memberRes.data ?? []) as Array<{ network_id: string }>) {
      merchantMap.set(row.network_id, (merchantMap.get(row.network_id) ?? 0) + 1)
    }

    for (const row of (pointsRes.data ?? []) as Array<{
      network_id: string
      base_points: number | null
      bonus_points: number | null
    }>) {
      const pts = Number(row.base_points ?? 0) + Number(row.bonus_points ?? 0)
      pointsMap.set(row.network_id, (pointsMap.get(row.network_id) ?? 0) + pts)
    }

    const since30d = new Date(Date.now() - 30 * 86400 * 1000).toISOString()
    const totalMap = new Map<string, number>()
    const activeMap = new Map<string, number>()
    for (const row of (clientRes.data ?? []) as Array<{
      network_id: string
      last_activity_at: string | null
    }>) {
      totalMap.set(row.network_id, (totalMap.get(row.network_id) ?? 0) + 1)
      if (row.last_activity_at && row.last_activity_at >= since30d) {
        activeMap.set(row.network_id, (activeMap.get(row.network_id) ?? 0) + 1)
      }
    }
    for (const [id, total] of totalMap) {
      retentionMap.set(id, total > 0 ? Math.round(((activeMap.get(id) ?? 0) / total) * 100) : 0)
    }
  }

  const items: AdminNetworkListItem[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: toLocalizedString(row.name, 'Réseau'),
    description: toLocalizedString(row.description, ''),
    emoji: row.emoji?.trim() || '🌐',
    primaryColor: row.primary_color?.trim() || '#5B4FE8',
    category: (row.category as NetworkCategory) || 'custom',
    tags: row.tags ?? [],
    status: resolveStatus(row),
    multiplier: Number(row.points_multiplier ?? 1),
    memberCount: Number(row.client_count ?? 0),
    merchantCount: merchantMap.get(row.id) ?? Number(row.member_count ?? 0),
    dailyPoints: Math.round(pointsMap.get(row.id) ?? 0),
    retentionPct: retentionMap.get(row.id) ?? 0,
    isPublic: Boolean(row.is_public),
    isFeatured: Boolean(row.is_featured),
    createdAt: row.created_at,
  }))

  const stats: AdminNetworksListStats = {
    activeNetworks: items.filter((n) => n.status === 'active').length,
    totalMerchants: items.reduce((s, n) => s + n.merchantCount, 0),
    activeUsers: items.reduce((s, n) => s + n.memberCount, 0),
    pointsDistributed: items.reduce((s, n) => s + n.dailyPoints, 0),
  }

  return { items, stats }
}

// ─── Fetcher: single config ───────────────────────────────────────────────────

async function fetchNetworkConfig(networkId: string): Promise<NetworkConfig> {
  const { data: networkRow, error } = await supabase
    .from('networks')
    .select(
      'id, slug, name, description, emoji, primary_color, secondary_color, logo_url, banner_url, website_url, category, tags, membership_type, requires_validation, max_members, client_access, points_multiplier, multiplier_mode, coalition_enabled, transfer_rate, welcome_bonus_points, is_public, is_featured, is_active, is_draft, provider_criteria, member_count, client_count, created_at, updated_at',
    )
    .eq('id', networkId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!networkRow) throw new Error('Réseau introuvable')

  const row = networkRow as NetworkConfigRow

  // Tiers — try DB rows, fall back to defaults
  let tiers: NetworkTier[] = DEFAULT_TIERS
  const { data: tierData, error: tierErr } = await supabase
    .from('tiers')
    .select('id, network_id, label, min_points')
    .eq('network_id', networkId)
    .order('min_points', { ascending: true })

  if (!tierErr && tierData && (tierData as unknown[]).length > 0) {
    tiers = (
      tierData as Array<{ id?: string; network_id?: string; label: string; min_points: number }>
    ).map((t) => ({
      id: t.id,
      networkId: t.network_id,
      label: t.label,
      minPoints: Number(t.min_points),
    }))
  }

  // Institutional partners — via institution_network_access
  let institutionalPartners: InstitutionalPartner[] = []
  const { data: accessData, error: accessErr } = await supabase
    .from('institution_network_access')
    .select('id, profile_id, created_at')
    .eq('network_id', networkId)

  if (!accessErr && accessData) {
    const profileIds = (accessData as Array<{ profile_id: string }>).map((r) => r.profile_id)
    if (profileIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, nom, prenom, role')
        .in('id', profileIds)

      const profileMap = new Map<
        string,
        { nom?: string | null; prenom?: string | null; role?: string | null }
      >()
      for (const p of (profileData ?? []) as Array<{
        id: string
        nom?: string | null
        prenom?: string | null
        role?: string | null
      }>) {
        profileMap.set(p.id, p)
      }

      institutionalPartners = (
        accessData as Array<{ id: string; profile_id: string; created_at: string }>
      ).map((r) => {
        const profile = profileMap.get(r.profile_id)
        return {
          id: r.id,
          networkId,
          profileId: r.profile_id,
          name:
            [profile?.prenom?.trim(), profile?.nom?.trim()].filter(Boolean).join(' ') ||
            'Institution',
          role: profile?.role ?? 'institution',
          joinedAt: r.created_at,
        }
      })
    }
  }

  const criteria = parseCriteria(row.provider_criteria)

  return {
    id: row.id,
    slug: row.slug,
    name: toLocalizedString(row.name, 'Réseau'),
    description: toLocalizedString(row.description, ''),
    emoji: row.emoji?.trim() || '🌐',
    primaryColor: row.primary_color?.trim() || '#5B4FE8',
    secondaryColor: row.secondary_color ?? null,
    logoUrl: row.logo_url ?? null,
    bannerUrl: row.banner_url ?? null,
    websiteUrl: row.website_url ?? null,
    category: (row.category as NetworkCategory) || 'custom',
    tags: row.tags ?? [],
    membershipType: (row.membership_type as MembershipType) || 'validated',
    requiresValidation: Boolean(row.requires_validation ?? true),
    maxMembers: row.max_members ?? null,
    clientAccess: (row.client_access as ClientAccess) || 'open',
    pointsMultiplier: Number(row.points_multiplier ?? 1),
    multiplierMode: (row.multiplier_mode as MultiplierMode) || 'additive',
    coalitionEnabled: Boolean(row.coalition_enabled),
    transferRate: Number(row.transfer_rate ?? 1),
    welcomeBonusPoints: Number(row.welcome_bonus_points ?? 0),
    isPublic: Boolean(row.is_public),
    isFeatured: Boolean(row.is_featured),
    isActive: Boolean(row.is_active),
    isDraft: Boolean(row.is_draft),
    status: resolveStatus(row),
    memberCount: Number(row.member_count ?? 0),
    clientCount: Number(row.client_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...criteria,
    tiers,
    institutionalPartners,
  }
}

// ─── Mutators ─────────────────────────────────────────────────────────────────

async function patchNetworkConfig(networkId: string, patch: NetworkConfigPatch): Promise<void> {
  const directPatch: Record<string, unknown> = {}

  if (patch.name !== undefined) directPatch.name = { fr: patch.name, en: patch.name }
  if (patch.description !== undefined) directPatch.description = { fr: patch.description, en: patch.description }
  if (patch.emoji !== undefined) directPatch.emoji = patch.emoji
  if (patch.primaryColor !== undefined) directPatch.primary_color = patch.primaryColor
  if (patch.secondaryColor !== undefined) directPatch.secondary_color = patch.secondaryColor
  if (patch.logoUrl !== undefined) directPatch.logo_url = patch.logoUrl
  if (patch.bannerUrl !== undefined) directPatch.banner_url = patch.bannerUrl
  if (patch.websiteUrl !== undefined) directPatch.website_url = patch.websiteUrl
  if (patch.category !== undefined) directPatch.category = patch.category
  if (patch.tags !== undefined) directPatch.tags = patch.tags
  if (patch.membershipType !== undefined) directPatch.membership_type = patch.membershipType
  if (patch.requiresValidation !== undefined) directPatch.requires_validation = patch.requiresValidation
  if (patch.maxMembers !== undefined) directPatch.max_members = patch.maxMembers
  if (patch.clientAccess !== undefined) directPatch.client_access = patch.clientAccess
  if (patch.pointsMultiplier !== undefined) directPatch.points_multiplier = patch.pointsMultiplier
  if (patch.multiplierMode !== undefined) directPatch.multiplier_mode = patch.multiplierMode
  if (patch.coalitionEnabled !== undefined) directPatch.coalition_enabled = patch.coalitionEnabled
  if (patch.transferRate !== undefined) directPatch.transfer_rate = patch.transferRate
  if (patch.welcomeBonusPoints !== undefined) directPatch.welcome_bonus_points = patch.welcomeBonusPoints
  if (patch.isPublic !== undefined) directPatch.is_public = patch.isPublic
  if (patch.isFeatured !== undefined) directPatch.is_featured = patch.isFeatured
  if (patch.isActive !== undefined) directPatch.is_active = patch.isActive
  if (patch.isDraft !== undefined) directPatch.is_draft = patch.isDraft
  directPatch.updated_at = new Date().toISOString()

  const criteriaDelta = buildCriteriaDelta(patch)
  if (Object.keys(criteriaDelta).length > 0) {
    const { data: current } = await supabase
      .from('networks')
      .select('provider_criteria')
      .eq('id', networkId)
      .maybeSingle()
    const existing =
      current?.provider_criteria && typeof current.provider_criteria === 'object'
        ? (current.provider_criteria as Record<string, unknown>)
        : {}
    directPatch.provider_criteria = { ...existing, ...criteriaDelta }
  }

  const { error } = await supabase.from('networks').update(directPatch).eq('id', networkId)
  if (error) throw new Error(error.message)
}

async function patchNetworkStatus(networkId: string, status: AdminNetworkStatus): Promise<void> {
  const { error } = await supabase
    .from('networks')
    .update({
      is_active: status === 'active',
      is_draft: status === 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', networkId)
  if (error) throw new Error(error.message)
}

async function insertNetwork(input: CreateNetworkInput): Promise<string> {
  const { data, error } = await supabase
    .from('networks')
    .insert({
      slug: input.slug,
      name: { fr: input.name, en: input.name },
      description: input.description
        ? { fr: input.description, en: input.description }
        : { fr: '', en: '' },
      emoji: input.emoji ?? '🌐',
      primary_color: input.primaryColor ?? '#5B4FE8',
      category: input.category,
      tags: input.tags ?? [],
      points_multiplier: input.multiplier ?? 1.5,
      is_public: input.isPublic ?? true,
      membership_type: input.membershipType ?? 'validated',
      requires_validation: input.requiresValidation ?? true,
      is_active: true,
      is_draft: false,
      provider_criteria: {},
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error("Aucun id retourné lors de la création du réseau")

  // Default tiers — non-critical, warn on failure
  const tierPayload = DEFAULT_TIERS.map((t) => ({
    network_id: data.id,
    label: t.label,
    min_points: t.minPoints,
  }))
  const { error: tierErr } = await supabase.from('tiers').insert(tierPayload)
  if (tierErr) {
    console.warn('[useAdminNetworks] Tier insert skipped:', tierErr.message)
  }

  return data.id
}

async function softDeleteNetwork(networkId: string): Promise<void> {
  // Check active merchant memberships before deleting
  const { data: memberData, error: memberErr } = await supabase
    .from('network_members')
    .select('id')
    .eq('network_id', networkId)
    .eq('status', 'active')
    .limit(1)

  if (memberErr) throw new Error(memberErr.message)
  if ((memberData ?? []).length > 0) {
    throw new Error("Le réseau a des marchands actifs. Désactivez-les avant de le supprimer.")
  }

  // Attempt soft delete via deleted_at; fall back to is_active flag if column absent
  const { error: delErr } = await supabase
    .from('networks')
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', networkId)

  if (delErr) {
    if (delErr.code === '42703' || delErr.message.includes('deleted_at')) {
      // Column doesn't exist — use is_active/is_draft as proxy
      const { error: fallbackErr } = await supabase
        .from('networks')
        .update({ is_active: false, is_draft: true, updated_at: new Date().toISOString() })
        .eq('id', networkId)
      if (fallbackErr) throw new Error(fallbackErr.message)
    } else {
      throw new Error(delErr.message)
    }
  }
}

// ─── Query hooks ──────────────────────────────────────────────────────────────

/** Fetch all networks with aggregated stats. queryKey: ['admin', 'networks', 'list'] */
export function useNetworksList() {
  return useQuery({
    queryKey: [...QK_BASE, 'list'],
    queryFn: fetchNetworksList,
    staleTime: STALE_TIME,
  })
}

/** Fetch full config for a single network. queryKey: ['admin', 'networks', networkId] */
export function useNetworkConfig(networkId: string) {
  return useQuery({
    queryKey: [...QK_BASE, networkId],
    queryFn: () => fetchNetworkConfig(networkId),
    staleTime: STALE_TIME,
    enabled: Boolean(networkId),
  })
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

/**
 * Debounced config patch (default 1500 ms).
 * Invalidates ['admin', 'networks', networkId] on success.
 *
 * Usage:
 *   const { update, isPending } = useUpdateNetworkConfig()
 *   update(networkId, { name: 'Nouveau nom', pointsMultiplier: 2 })
 */
export function useUpdateNetworkConfig(delay = 1500) {
  const queryClient = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mutation = useMutation({
    mutationFn: ({ networkId, patch }: { networkId: string; patch: NetworkConfigPatch }) =>
      patchNetworkConfig(networkId, patch),
    onSuccess: (_, { networkId }) => {
      showToast('Configuration sauvegardée ✓', 'success')
      void queryClient.invalidateQueries({ queryKey: [...QK_BASE, networkId] })
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde', 'error')
    },
  })

  // Keep a stable ref to mutate so the debounce closure always calls the latest version
  const mutateRef = useRef(mutation.mutate)
  useEffect(() => {
    mutateRef.current = mutation.mutate
  })

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const update = useCallback(
    (networkId: string, patch: NetworkConfigPatch) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        mutateRef.current({ networkId, patch })
      }, delay)
    },
    [delay],
  )

  return { update, isPending: mutation.isPending }
}

/**
 * Toggle network status with optimistic update + rollback on error.
 *
 * Usage:
 *   const { toggle, isPending } = useToggleNetworkStatus()
 *   toggle(networkId, 'paused')
 */
export function useToggleNetworkStatus() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ networkId, status }: { networkId: string; status: AdminNetworkStatus }) =>
      patchNetworkStatus(networkId, status),

    onMutate: async ({ networkId, status }) => {
      await queryClient.cancelQueries({ queryKey: [...QK_BASE, networkId] })

      const previousConfig = queryClient.getQueryData<NetworkConfig>([...QK_BASE, networkId])
      const previousList = queryClient.getQueryData<AdminNetworksListResult>([...QK_BASE, 'list'])

      if (previousConfig) {
        queryClient.setQueryData<NetworkConfig>([...QK_BASE, networkId], {
          ...previousConfig,
          status,
          isActive: status === 'active',
          isDraft: status === 'draft',
        })
      }

      if (previousList) {
        queryClient.setQueryData<AdminNetworksListResult>([...QK_BASE, 'list'], {
          ...previousList,
          items: previousList.items.map((item) =>
            item.id === networkId ? { ...item, status } : item,
          ),
        })
      }

      return { previousConfig, previousList }
    },

    onError: (
      err: unknown,
      { networkId },
      context: { previousConfig: NetworkConfig | undefined; previousList: AdminNetworksListResult | undefined } | undefined,
    ) => {
      if (context?.previousConfig) {
        queryClient.setQueryData([...QK_BASE, networkId], context.previousConfig)
      }
      if (context?.previousList) {
        queryClient.setQueryData([...QK_BASE, 'list'], context.previousList)
      }
      showToast(err instanceof Error ? err.message : 'Erreur lors du changement de statut', 'error')
    },

    onSuccess: (_, { status }) => {
      const labels: Record<AdminNetworkStatus, string> = {
        active: 'Réseau activé ✓',
        paused: 'Réseau mis en pause ✓',
        draft: 'Réseau passé en brouillon ✓',
      }
      showToast(labels[status], 'success')
      void queryClient.invalidateQueries({ queryKey: QK_BASE })
    },
  })

  const toggle = useCallback(
    (networkId: string, status: AdminNetworkStatus) =>
      mutation.mutateAsync({ networkId, status }),
    [mutation],
  )

  return { toggle, isPending: mutation.isPending }
}

/**
 * Create a network and insert default tiers.
 * Returns the new network id on success.
 *
 * Usage:
 *   const { create, isPending } = useCreateNetwork()
 *   const newId = await create(input)
 */
export function useCreateNetwork() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (input: CreateNetworkInput) => insertNetwork(input),
    onSuccess: () => {
      showToast('Réseau créé avec succès ✓', 'success')
      void queryClient.invalidateQueries({ queryKey: [...QK_BASE, 'list'] })
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la création', 'error')
    },
  })

  const create = useCallback(
    (input: CreateNetworkInput) => mutation.mutateAsync(input),
    [mutation],
  )

  return { create, isPending: mutation.isPending }
}

/**
 * Soft-delete a network after asserting no active merchants.
 *
 * Usage:
 *   const { remove, isPending } = useDeleteNetwork()
 *   await remove(networkId)
 */
export function useDeleteNetwork() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (networkId: string) => softDeleteNetwork(networkId),
    onSuccess: (_, networkId) => {
      showToast('Réseau supprimé ✓', 'success')
      queryClient.removeQueries({ queryKey: [...QK_BASE, networkId] })
      void queryClient.invalidateQueries({ queryKey: [...QK_BASE, 'list'] })
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la suppression', 'error')
    },
  })

  const remove = useCallback(
    (networkId: string) => mutation.mutateAsync(networkId),
    [mutation],
  )

  return { remove, isPending: mutation.isPending }
}

// ─── Composite hook ───────────────────────────────────────────────────────────

/**
 * All-in-one hook for the admin networks management pages.
 *
 * Bundles: list + stats + all mutations.
 * For single-network config, use useNetworkConfig(id) directly.
 */
export function useAdminNetworks() {
  const listQuery = useNetworksList()
  const { update, isPending: isUpdating } = useUpdateNetworkConfig()
  const { toggle, isPending: isToggling } = useToggleNetworkStatus()
  const { create, isPending: isCreating } = useCreateNetwork()
  const { remove, isPending: isDeleting } = useDeleteNetwork()

  return useMemo(
    () => ({
      // List data
      networks: listQuery.data?.items ?? [],
      stats: listQuery.data?.stats ?? EMPTY_STATS,
      isLoading: listQuery.isLoading,
      error: listQuery.error as Error | null,
      refetch: listQuery.refetch,

      // Mutations
      updateConfig: update,
      toggleStatus: toggle,
      createNetwork: create,
      deleteNetwork: remove,

      // Pending flags
      isUpdating,
      isToggling,
      isCreating,
      isDeleting,
    }),
    [
      listQuery.data,
      listQuery.isLoading,
      listQuery.error,
      listQuery.refetch,
      update,
      toggle,
      create,
      remove,
      isUpdating,
      isToggling,
      isCreating,
      isDeleting,
    ],
  )
}
