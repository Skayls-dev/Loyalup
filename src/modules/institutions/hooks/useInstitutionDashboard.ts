import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getClientGrowthTimeline,
  getGeographicBreakdown,
  getOverview,
  getMerchantLeaderboard,
} from '../services/institutionAnalyticsService'
import type {
  GeographicEntry,
  GrowthPoint,
  InstitutionOverview,
  MerchantLeaderboardEntry,
  Period,
} from '../types/institutionTypes'

type UseInstitutionDashboardResult = {
  overview: InstitutionOverview | null
  growthTimeline: GrowthPoint[]
  merchantLeaderboard: MerchantLeaderboardEntry[]
  geographicBreakdown: GeographicEntry[]
  loading: boolean
  period: Period
  setPeriod: (period: Period) => void
}

export function useInstitutionDashboard(): UseInstitutionDashboardResult {
  const [period, setPeriod] = useState<Period>('30d')

  // Fetch overview
  const overviewQuery = useQuery({
    queryKey: ['institution-overview', period],
    queryFn: () => getOverview(period),
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  })

  // Fetch growth timeline
  const growthTimelineQuery = useQuery({
    queryKey: ['institution-growth-timeline', period],
    queryFn: () => getClientGrowthTimeline(period),
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  })

  // Fetch merchant leaderboard
  const merchantLeaderboardQuery = useQuery({
    queryKey: ['institution-merchant-leaderboard', period],
    queryFn: () => getMerchantLeaderboard(period),
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  })

  // Fetch geographic breakdown
  const geographicBreakdownQuery = useQuery({
    queryKey: ['institution-geographic-breakdown'],
    queryFn: () => getGeographicBreakdown(),
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  })

  const loading =
    overviewQuery.isLoading ||
    growthTimelineQuery.isLoading ||
    merchantLeaderboardQuery.isLoading ||
    geographicBreakdownQuery.isLoading

  return useMemo(
    () => ({
      overview: overviewQuery.data ?? null,
      growthTimeline: growthTimelineQuery.data ?? [],
      merchantLeaderboard: merchantLeaderboardQuery.data ?? [],
      geographicBreakdown: geographicBreakdownQuery.data ?? [],
      loading,
      period,
      setPeriod,
    }),
    [overviewQuery.data, growthTimelineQuery.data, merchantLeaderboardQuery.data, geographicBreakdownQuery.data, loading, period],
  )
}
