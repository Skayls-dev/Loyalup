import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../shared/lib/supabaseClient'
import { requireOnlineForWrite, withCachedRead } from '../../../shared/lib/offlineGuard'

export type PromotionType = 'double_points' | 'discount' | 'free_item' | 'custom'

export type Promotion = {
  id: string
  fournisseur_id: string
  titre: string
  description: string
  emoji: string
  type: PromotionType
  valeur: number | null
  date_debut: string
  date_fin: string
  actif: boolean
  created_at: string
}

export type PromotionGroup = {
  fournisseur_id: string
  fournisseur_nom: string
  promotions: Promotion[]
}

export type CreatePromoParams = {
  fournisseur_id: string
  titre: string
  description: string
  emoji: string
  type: PromotionType
  valeur?: number | null
  date_debut: string
  date_fin: string
}

export type UpdatePromoParams = Partial<Omit<CreatePromoParams, 'fournisseur_id'>>

type PromotionCallback = (promotion: Promotion) => void

export async function getActivePromotions(fournisseur_id: string): Promise<Promotion[]> {
  return withCachedRead(`promotions:active:${fournisseur_id}`, async () => {
    const { data, error } = await supabase
      .from('active_promotions')
      .select('id, fournisseur_id, titre, description, emoji, type, valeur, date_debut, date_fin, actif, created_at')
      .eq('fournisseur_id', fournisseur_id)
      .order('date_fin', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []) as Promotion[]
  })
}

export async function getAllClientPromotions(client_id: string): Promise<PromotionGroup[]> {
  return withCachedRead(`promotions:client:${client_id}`, async () => {
    const { data: providersData, error: providersError } = await supabase
      .from('client_points')
      .select('fournisseur_id')
      .eq('client_id', client_id)

    if (providersError) {
      throw new Error(providersError.message)
    }

    const providerRows = (providersData ?? []) as Array<{ fournisseur_id: string }>

    const providerIds = [...new Set(providerRows.map((row) => row.fournisseur_id))]

    if (providerIds.length === 0) {
      return []
    }

    const providerNameMap = new Map<string, string>()

    const { data: fournisseursData, error: fournisseursError } = await supabase
      .from('fournisseurs')
      .select('id, nom_commerce')
      .in('id', providerIds)

    if (fournisseursError) {
      throw new Error(fournisseursError.message)
    }

    for (const fournisseur of (fournisseursData ?? []) as Array<{ id: string; nom_commerce: string }>) {
      providerNameMap.set(fournisseur.id, fournisseur.nom_commerce)
    }

    const { data: promosData, error: promosError } = await supabase
      .from('active_promotions')
      .select('id, fournisseur_id, titre, description, emoji, type, valeur, date_debut, date_fin, actif, created_at')
      .in('fournisseur_id', providerIds)
      .order('created_at', { ascending: false })

    if (promosError) {
      throw new Error(promosError.message)
    }

    const groupedMap = new Map<string, Promotion[]>()

    for (const promotion of (promosData ?? []) as Promotion[]) {
      const existing = groupedMap.get(promotion.fournisseur_id) ?? []
      existing.push(promotion)
      groupedMap.set(promotion.fournisseur_id, existing)
    }

    return providerIds.map((providerId) => ({
      fournisseur_id: providerId,
      fournisseur_nom: providerNameMap.get(providerId) ?? 'Commerce',
      promotions: groupedMap.get(providerId) ?? [],
    }))
  })
}

export async function getProviderPromotions(fournisseur_id: string): Promise<Promotion[]> {
  return withCachedRead(`promotions:provider:${fournisseur_id}`, async () => {
    const { data, error } = await supabase
      .from('promotions')
      .select('id, fournisseur_id, titre, description, emoji, type, valeur, date_debut, date_fin, actif, created_at')
      .eq('fournisseur_id', fournisseur_id)
      .order('date_debut', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []) as Promotion[]
  })
}

export async function createPromotion(params: CreatePromoParams): Promise<Promotion> {
  requireOnlineForWrite()

  const { data, error } = await supabase
    .from('promotions')
    .insert({
      fournisseur_id: params.fournisseur_id,
      titre: params.titre,
      description: params.description,
      emoji: params.emoji,
      type: params.type,
      valeur: params.valeur ?? null,
      date_debut: params.date_debut,
      date_fin: params.date_fin,
      actif: true,
    })
    .select('id, fournisseur_id, titre, description, emoji, type, valeur, date_debut, date_fin, actif, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Promotion
}

export async function updatePromotion(id: string, updates: UpdatePromoParams): Promise<Promotion> {
  requireOnlineForWrite()

  const { data, error } = await supabase
    .from('promotions')
    .update({
      ...updates,
      valeur: updates.valeur ?? null,
    })
    .eq('id', id)
    .select('id, fournisseur_id, titre, description, emoji, type, valeur, date_debut, date_fin, actif, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Promotion
}

export async function deletePromotion(id: string): Promise<void> {
  requireOnlineForWrite()

  const { error } = await supabase
    .from('promotions')
    .update({ actif: false })
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

export function subscribeToPromotions(fournisseur_id: string, callback: PromotionCallback): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`promotions-${fournisseur_id}-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'promotions',
        filter: `fournisseur_id=eq.${fournisseur_id}`,
      },
      (payload) => {
        const promotion = payload.new as Promotion
        if (promotion?.actif) {
          callback(promotion)
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
