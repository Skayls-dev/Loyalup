import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { supabase } from '../../../shared/lib/supabaseClient'
import {
  createRewardRule,
  deleteRewardRule,
  getRewardRules,
  toggleRewardRule,
  updateRewardRule,
  type CreateRewardRuleParams,
  type RewardRuleItem,
  type UpdateRewardRuleParams,
} from '../services/providerService'

type UseRewardRuleManagerResult = {
  rules: RewardRuleItem[]
  loading: boolean
  fournisseurId: string | null
  createItem: (data: Omit<CreateRewardRuleParams, 'fournisseur_id'>) => Promise<void>
  updateItem: (id: string, updates: UpdateRewardRuleParams) => Promise<void>
  toggleItem: (id: string, actif: boolean) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useRewardRuleManager(): UseRewardRuleManagerResult {
  const { user } = useAuth()
  const [fournisseurId, setFournisseurId] = useState<string | null>(null)
  const [rules, setRules] = useState<RewardRuleItem[]>([])
  const [loading, setLoading] = useState(true)

  const resolveProvider = useCallback(async () => {
    if (!user?.id) {
      return null
    }

    const { data, error } = await supabase
      .from('fournisseurs')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    return (data?.id as string | undefined) ?? null
  }, [user?.id])

  const refresh = useCallback(async () => {
    setLoading(true)

    try {
      const providerId = await resolveProvider()
      setFournisseurId(providerId)

      if (!providerId) {
        setRules([])
        return
      }

      const rows = await getRewardRules(providerId)
      setRules(rows)
    } finally {
      setLoading(false)
    }
  }, [resolveProvider])

  useEffect(() => {
    refresh().catch(() => null)
  }, [refresh])

  const createItem = useCallback(async (data: Omit<CreateRewardRuleParams, 'fournisseur_id'>) => {
    if (!fournisseurId) {
      throw new Error('Provider not found')
    }

    const optimisticId = `temp-${crypto.randomUUID()}`
    const optimistic: RewardRuleItem = {
      id: optimisticId,
      fournisseur_id: fournisseurId,
      nom: data.nom,
      description: data.description,
      emoji: data.emoji,
      points_required: data.points_required,
      expiry_date: data.expiry_date ?? null,
      actif: true,
      created_at: new Date().toISOString(),
    }

    setRules((prev) => [...prev, optimistic])

    try {
      const created = await createRewardRule({ ...data, fournisseur_id: fournisseurId })
      setRules((prev) => [...prev.filter((item) => item.id !== optimisticId), created])
    } catch (error) {
      setRules((prev) => prev.filter((item) => item.id !== optimisticId))
      throw error
    }
  }, [fournisseurId])

  const updateItem = useCallback(async (id: string, updates: UpdateRewardRuleParams) => {
    const previous = rules
    setRules((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))

    try {
      const updated = await updateRewardRule(id, updates)
      setRules((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (error) {
      setRules(previous)
      throw error
    }
  }, [rules])

  const toggleItem = useCallback(async (id: string, actif: boolean) => {
    const previous = rules
    setRules((prev) => prev.map((item) => (item.id === id ? { ...item, actif } : item)))

    try {
      const updated = await toggleRewardRule(id, actif)
      setRules((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (error) {
      setRules(previous)
      throw error
    }
  }, [rules])

  const deleteItem = useCallback(async (id: string) => {
    const previous = rules
    setRules((prev) => prev.filter((item) => item.id !== id))

    try {
      await deleteRewardRule(id)
    } catch (error) {
      setRules(previous)
      throw error
    }
  }, [rules])

  return {
    rules,
    loading,
    fournisseurId,
    createItem,
    updateItem,
    toggleItem,
    deleteItem,
    refresh,
  }
}
