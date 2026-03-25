import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { supabase } from '../../../shared/lib/supabaseClient'
import {
  createService,
  getProviderServices,
  toggleService,
  updateService,
  type CreateServiceParams,
  type ServiceItem,
  type UpdateServiceParams,
} from '../services/providerService'

type UseServiceManagerResult = {
  services: ServiceItem[]
  loading: boolean
  fournisseurId: string | null
  createItem: (data: Omit<CreateServiceParams, 'fournisseur_id'>) => Promise<ServiceItem>
  updateItem: (id: string, updates: UpdateServiceParams) => Promise<void>
  toggleItem: (id: string, actif: boolean) => Promise<void>
  refresh: () => Promise<void>
}

export function useServiceManager(): UseServiceManagerResult {
  const { user } = useAuth()
  const [fournisseurId, setFournisseurId] = useState<string | null>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
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
        setServices([])
        return
      }

      const rows = await getProviderServices(providerId)
      setServices(rows)
    } finally {
      setLoading(false)
    }
  }, [resolveProvider])

  useEffect(() => {
    refresh().catch(() => null)
  }, [refresh])

  const createItem = useCallback(async (data: Omit<CreateServiceParams, 'fournisseur_id'>) => {
    if (!fournisseurId) {
      throw new Error('Provider not found')
    }

    const optimisticId = `temp-${crypto.randomUUID()}`
    const optimistic: ServiceItem = {
      id: optimisticId,
      fournisseur_id: fournisseurId,
      nom: data.nom,
      emoji: data.emoji,
      image_url: data.image_url ?? null,
      prix_defaut: data.prix_defaut ?? null,
      points_defaut: data.points_defaut ?? null,
      points_per_euro: data.points_per_euro ?? 10,
      actif: true,
      created_at: new Date().toISOString(),
    }

    setServices((prev) => [...prev, optimistic])

    try {
      const created = await createService({ ...data, fournisseur_id: fournisseurId })
      setServices((prev) => [...prev.filter((item) => item.id !== optimisticId), created])
      return created
    } catch (error) {
      setServices((prev) => prev.filter((item) => item.id !== optimisticId))
      throw error
    }
  }, [fournisseurId])

  const updateItem = useCallback(async (id: string, updates: UpdateServiceParams) => {
    const previous = services
    setServices((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))

    try {
      const updated = await updateService(id, updates)
      setServices((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (error) {
      setServices(previous)
      throw error
    }
  }, [services])

  const toggleItem = useCallback(async (id: string, actif: boolean) => {
    const previous = services
    setServices((prev) => prev.map((item) => (item.id === id ? { ...item, actif } : item)))

    try {
      const updated = await toggleService(id, actif)
      setServices((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (error) {
      setServices(previous)
      throw error
    }
  }, [services])

  return {
    services,
    loading,
    fournisseurId,
    createItem,
    updateItem,
    toggleItem,
    refresh,
  }
}
