import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/hooks/useAuth'
import {
  getDataAssetValue,
  getRecentJobsLog,
  getPlatformStats,
  getProviderHealthScores,
  runDailyJobsNow,
  getSegmentDistribution,
} from '../services/analyticsService'

export function useAdminAnalytics() {
  const { role } = useAuth()
  const enabled = role === 'admin'
  const [runningJobs, setRunningJobs] = useState(false)
  const [runJobsError, setRunJobsError] = useState<string | null>(null)
  const [lastRunSummary, setLastRunSummary] = useState<string | null>(null)

  const platformQuery = useQuery({
    queryKey: ['admin-platform-stats'],
    enabled,
    queryFn: getPlatformStats,
  })

  const segmentQuery = useQuery({
    queryKey: ['admin-segment-distribution'],
    enabled,
    queryFn: getSegmentDistribution,
  })

  const healthQuery = useQuery({
    queryKey: ['admin-provider-health'],
    enabled,
    queryFn: getProviderHealthScores,
  })

  const dataAssetQuery = useQuery({
    queryKey: ['admin-data-asset'],
    enabled,
    queryFn: getDataAssetValue,
  })

  const jobsLogQuery = useQuery({
    queryKey: ['admin-jobs-log'],
    enabled,
    queryFn: () => getRecentJobsLog(20),
    refetchInterval: 30 * 1000,
  })

  async function runJobsNow() {
    if (!enabled || runningJobs) {
      return
    }

    setRunningJobs(true)
    setRunJobsError(null)

    try {
      const result = await runDailyJobsNow()
      const successCount = (result.jobs ?? []).filter((job) => job.status === 'success').length
      const total = (result.jobs ?? []).length
      setLastRunSummary(`${successCount}/${total} jobs succeeded`)

      await Promise.all([
        jobsLogQuery.refetch(),
        platformQuery.refetch(),
        segmentQuery.refetch(),
        healthQuery.refetch(),
        dataAssetQuery.refetch(),
      ])
    } catch (error) {
      setRunJobsError(error instanceof Error ? error.message : 'Failed to run jobs')
    } finally {
      setRunningJobs(false)
    }
  }

  return useMemo(
    () => ({
      platformStats: platformQuery.data,
      segmentDistribution: segmentQuery.data ?? [],
      providerHealth: healthQuery.data ?? [],
      dataAssetValue: dataAssetQuery.data,
      jobsLog: jobsLogQuery.data ?? [],
      runningJobs,
      runJobsError,
      lastRunSummary,
      runJobsNow,
      loading:
        platformQuery.isLoading ||
        segmentQuery.isLoading ||
        healthQuery.isLoading ||
        dataAssetQuery.isLoading ||
        jobsLogQuery.isLoading,
    }),
    [
      dataAssetQuery.data,
      dataAssetQuery.isLoading,
      healthQuery.data,
      healthQuery.isLoading,
      jobsLogQuery.data,
      jobsLogQuery.isLoading,
      lastRunSummary,
      platformQuery.data,
      platformQuery.isLoading,
      runJobsError,
      runningJobs,
      segmentQuery.refetch,
      platformQuery.refetch,
      healthQuery.refetch,
      dataAssetQuery.refetch,
      jobsLogQuery.refetch,
      segmentQuery.data,
      segmentQuery.isLoading,
      runJobsNow,
    ],
  )
}
