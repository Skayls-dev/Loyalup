import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export interface ChallengeItem {
  id: string
  icon: string
  name: string
  current: number
  target: number
  rewardPoints: number
}

export interface UseChallengesResult {
  challenges: ChallengeItem[]
  loading: boolean
  error: string | null
}

type ChallengeRow = {
  id: string
  title: unknown
  emoji: string | null
  target_value: number | null
  reward_points: number | null
}

type ProgressRow = {
  challenge_id: string
  current_value: number | null
}

function resolveLocalizedTitle(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object') {
    const asRecord = value as Record<string, unknown>
    if (typeof asRecord.fr === 'string') return asRecord.fr
    if (typeof asRecord.en === 'string') return asRecord.en
  }

  return 'Défi'
}

export function useChallenges(userId?: string): UseChallengesResult {
  const [challenges, setChallenges] = useState<ChallengeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setChallenges([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const nowIso = new Date().toISOString()

        const { data: activeChallengesData, error: activeChallengesError } = await supabase
          .from('challenges')
          .select('id, title, emoji, target_value, reward_points')
          .eq('is_active', true)
          .lte('starts_at', nowIso)
          .gte('ends_at', nowIso)
          .order('ends_at', { ascending: true })
          .limit(6)

        if (activeChallengesError) {
          throw new Error(activeChallengesError.message)
        }

        const activeChallenges = (activeChallengesData ?? []) as ChallengeRow[]
        const challengeIds = activeChallenges.map((challenge) => challenge.id)

        let progressRows: ProgressRow[] = []

        if (challengeIds.length > 0) {
          const { data: progressData, error: progressError } = await supabase
            .from('client_challenge_progress')
            .select('challenge_id, current_value')
            .eq('client_id', userId)
            .in('challenge_id', challengeIds)

          if (progressError) {
            throw new Error(progressError.message)
          }

          progressRows = (progressData ?? []) as ProgressRow[]
        }

        const progressMap = new Map<string, number>()
        for (const progress of progressRows) {
          progressMap.set(progress.challenge_id, Number(progress.current_value ?? 0))
        }

        const mapped: ChallengeItem[] = activeChallenges.map((challenge) => ({
          id: challenge.id,
          icon: challenge.emoji?.trim() || '🎯',
          name: resolveLocalizedTitle(challenge.title),
          current: Number(progressMap.get(challenge.id) ?? 0),
          target: Math.max(1, Number(challenge.target_value ?? 1)),
          rewardPoints: Number(challenge.reward_points ?? 0),
        }))

        if (!cancelled) {
          setChallenges(mapped)
          setLoading(false)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setChallenges([])
          setLoading(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger les défis')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [userId])

  return useMemo(() => ({ challenges, loading, error }), [challenges, loading, error])
}
