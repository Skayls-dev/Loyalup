import { useState, useEffect } from 'react'
import { getTopReferrers } from '../../services/networkService'

interface TopReferrersListProps {
  limit?: number
}

interface TopReferrer {
  client_id: string
  client_name: string
  referral_count: number
  xp_earned: number
}

export function TopReferrersList({ limit = 10 }: TopReferrersListProps) {
  const [referrers, setReferrers] = useState<TopReferrer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const loadReferrers = async () => {
      try {
        setLoading(true)
        const data = await getTopReferrers(limit)
        setReferrers(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load referrers'))
      } finally {
        setLoading(false)
      }
    }

    loadReferrers()
  }, [limit])

  if (loading) {
    return <div className="text-center py-4">Chargement...</div>
  }

  if (error) {
    return <div className="text-center py-4 text-red-600">Erreur: {error.message}</div>
  }

  const medalEmojis = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-2">
      {referrers.length === 0 ? (
        <div className="text-center py-4 text-gray-600">Aucun parrain trouvé</div>
      ) : (
        referrers.map((referrer, idx) => (
          <div
            key={referrer.client_id}
            className={`p-3 rounded-lg flex items-center justify-between border-2 ${
              idx < 3
                ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="text-2xl font-bold w-8 text-center">
                {idx < 3 ? medalEmojis[idx] : `#${idx + 1}`}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">{referrer.client_name}</p>
                <p className="text-xs text-gray-600">
                  {referrer.referral_count} parrainages
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-purple-600">{referrer.xp_earned.toLocaleString()}</p>
              <p className="text-xs text-gray-600">XP gagnés</p>
            </div>
          </div>
        ))
      )}
    </div>
  )
}



