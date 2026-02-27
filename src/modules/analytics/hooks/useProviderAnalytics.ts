import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/hooks/useAuth'
import { supabase } from '../../../shared/lib/supabaseClient'
import { usePremium } from '../../../shared/hooks/usePremium'
import {
  getBenchmarks,
  getClientSegments,
  getProviderDeepStats,
  getRevenueTimeline,
} from '../services/analyticsService'

type Period = '7d' | '30d' | '90d' | '12m'

export function useProviderAnalytics() {
  const { user } = useAuth()
  const { isPremium } = usePremium()
  const [period, setPeriod] = useState<Period>('30d')

  const providerQuery = useQuery({
    queryKey: ['provider-id', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from('fournisseurs')
        .select('id')
        .eq('user_id', user?.id ?? '')
        .maybeSingle()
      return String(data?.id ?? '')
    },
  })

  const providerId = providerQuery.data ?? ''

  const statsQuery = useQuery({
    queryKey: ['provider-analytics-stats', providerId, period],
    enabled: Boolean(providerId) && isPremium,
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => getProviderDeepStats(providerId, period),
  })

  const benchmarksQuery = useQuery({
    queryKey: ['provider-analytics-benchmarks', providerId],
    enabled: Boolean(providerId) && isPremium,
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => getBenchmarks(providerId),
  })

  const segmentsQuery = useQuery({
    queryKey: ['provider-analytics-segments', providerId],
    enabled: Boolean(providerId) && isPremium,
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => getClientSegments(providerId),
  })

  const timelineQuery = useQuery({
    queryKey: ['provider-analytics-timeline', providerId, period],
    enabled: Boolean(providerId) && isPremium,
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => getRevenueTimeline(providerId, period, period === '12m' ? 'monthly' : 'daily'),
  })

  const loading = providerQuery.isLoading || statsQuery.isLoading || benchmarksQuery.isLoading || segmentsQuery.isLoading

  return useMemo(
    () => ({
      stats: statsQuery.data,
      benchmarks: benchmarksQuery.data ?? [],
      segments: segmentsQuery.data?.distribution ?? [],
      champions: segmentsQuery.data?.champions ?? [],
      churnList: segmentsQuery.data?.atRisk ?? [],
      timeline: timelineQuery.data ?? [],
      loading,
      period,
      setPeriod,
      isPremium,
    }),
    [
      benchmarksQuery.data,
      isPremium,
      loading,
      period,
      segmentsQuery.data?.atRisk,
      segmentsQuery.data?.champions,
      segmentsQuery.data?.distribution,
      statsQuery.data,
      timelineQuery.data,
    ],
  )
}
