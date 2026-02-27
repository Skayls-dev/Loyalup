import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { supabase } from '../../../shared/lib/supabaseClient'
import {
  createPromotion,
  deletePromotion,
  getProviderPromotions,
  updatePromotion,
  type CreatePromoParams,
  type Promotion,
  type UpdatePromoParams,
} from '../services/promotionService'

type UsePromoManagerResult = {
  promotions: Promotion[]
  createPromo: (data: Omit<CreatePromoParams, 'fournisseur_id'>) => Promise<void>
  updatePromo: (id: string, data: UpdatePromoParams) => Promise<void>
  deletePromo: (id: string) => Promise<void>
  editingPromo: Promotion | null
  setEditingPromo: (promotion: Promotion | null) => void
  clearEditing: () => void
  loading: boolean
  error: string | null
  fournisseurId: string | null
}

export function usePromoManager(): UsePromoManagerResult {
  const { user } = useAuth()
  const [fournisseurId, setFournisseurId] = useState<string | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const resolveProvider = useCallback(async () => {
    if (!user?.id) {
      return null
    }

    const { data, error: providerError } = await supabase
      .from('fournisseurs')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (providerError) {
      throw new Error(providerError.message)
    }

    return (data?.id as string | undefined) ?? null
  }, [user?.id])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const providerId = await resolveProvider()
      setFournisseurId(providerId)

      if (!providerId) {
        setPromotions([])
        return
      }

      const rows = await getProviderPromotions(providerId)
      setPromotions(rows)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to load promotions'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [resolveProvider])

  useEffect(() => {
    load().catch(() => null)
  }, [load])

  const createPromo = useCallback(async (data: Omit<CreatePromoParams, 'fournisseur_id'>) => {
    if (!fournisseurId) {
      throw new Error('Provider not found')
    }

    const optimisticId = `temp-${crypto.randomUUID()}`
    const optimisticPromo: Promotion = {
      id: optimisticId,
      fournisseur_id: fournisseurId,
      titre: data.titre,
      description: data.description,
      emoji: data.emoji,
      type: data.type,
      valeur: data.valeur ?? null,
      date_debut: data.date_debut,
      date_fin: data.date_fin,
      actif: true,
      created_at: new Date().toISOString(),
    }

    setPromotions((prev) => [optimisticPromo, ...prev])

    try {
      const created = await createPromotion({ ...data, fournisseur_id: fournisseurId })
      setPromotions((prev) => [created, ...prev.filter((item) => item.id !== optimisticId)])
    } catch (caughtError) {
      setPromotions((prev) => prev.filter((item) => item.id !== optimisticId))
      throw caughtError
    }
  }, [fournisseurId])

  const updatePromo = useCallback(async (id: string, data: UpdatePromoParams) => {
    const previous = promotions
    setPromotions((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)))

    try {
      const updated = await updatePromotion(id, data)
      setPromotions((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (caughtError) {
      setPromotions(previous)
      throw caughtError
    }
  }, [promotions])

  const removePromo = useCallback(async (id: string) => {
    const previous = promotions
    setPromotions((prev) => prev.filter((item) => item.id !== id))

    try {
      await deletePromotion(id)
    } catch (caughtError) {
      setPromotions(previous)
      throw caughtError
    }
  }, [promotions])

  return {
    promotions,
    createPromo,
    updatePromo,
    deletePromo: removePromo,
    editingPromo,
    setEditingPromo,
    clearEditing: () => setEditingPromo(null),
    loading,
    error,
    fournisseurId,
  }
}
