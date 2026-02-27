import { useEffect, useState } from 'react'
import { getLeaderboard } from '../services/gamificationService'
import type { LeaderboardEntry } from '../services/gamificationService'

interface UseLeaderboardReturn {
  entries: LeaderboardEntry[]
  myRank: number | null
  myScore: number | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useLeaderboard(
  type: 'global_points' | 'global_xp' | 'provider_points' | 'referrals' | 'streak' = 'global_xp',
  fournisseurId?: string,
  period: string = 'all_time',
): UseLeaderboardReturn {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [myScore, setMyScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      const data = await getLeaderboard(type, fournisseurId, period)
      setEntries(data.entries)
      setMyRank(data.myRank)
      setMyScore(data.myScore)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch leaderboard'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [type, fournisseurId, period])

  return { entries, myRank, myScore, loading, error, refetch: fetchLeaderboard }
}
