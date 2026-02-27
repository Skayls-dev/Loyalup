import { useMemo } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'

type ProviderTier = 'free' | 'starter' | 'premium' | 'enterprise'

type UsePremiumResult = {
  tier: ProviderTier
  isPremium: boolean
  isStarter: boolean
  daysUntilExpiry: number | null
  isExpiringSoon: boolean
}

export function usePremium(): UsePremiumResult {
  const { user, role } = useAuth()

  const query = useQuery({
    queryKey: ['provider-tier', user?.id],
    enabled: Boolean(user?.id) && role === 'fournisseur',
    queryFn: async () => {
      const { data: fournisseur } = await supabase
        .from('fournisseurs')
        .select('tier, tier_expires_at')
        .eq('user_id', user?.id ?? '')
        .maybeSingle()

      return {
        tier: (fournisseur?.tier as ProviderTier | undefined) ?? 'free',
        tier_expires_at: (fournisseur?.tier_expires_at as string | null | undefined) ?? null,
      }
    },
  })

  return useMemo(() => {
    const tier = query.data?.tier ?? 'free'
    const expiresAt = query.data?.tier_expires_at ? new Date(query.data.tier_expires_at) : null
    const daysUntilExpiry = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null

    const isPremium = tier === 'premium' || tier === 'enterprise'
    const isStarter = tier === 'starter' || isPremium

    return {
      tier,
      isPremium,
      isStarter,
      daysUntilExpiry,
      isExpiringSoon: daysUntilExpiry !== null && daysUntilExpiry < 7,
    }
  }, [query.data?.tier, query.data?.tier_expires_at])
}
