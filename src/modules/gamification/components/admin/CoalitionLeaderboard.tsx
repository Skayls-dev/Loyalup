import { useState, useEffect } from 'react'
import { getCoalitionLeaderboard } from '../../services/networkService'

interface CoalitionLeaderboardProps {
  limit?: number
}

interface Coalition {
  coalition_id: string
  coalition_name: string
  total_members: number
  total_transfers: number
  total_points_transferred: number
}

export function CoalitionLeaderboard({ limit = 20 }: CoalitionLeaderboardProps) {
  const [coalitions, setCoalitions] = useState<Coalition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const loadCoalitions = async () => {
      try {
        setLoading(true)
        const data = await getCoalitionLeaderboard(limit)
        setCoalitions(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load coalitions'))
      } finally {
        setLoading(false)
      }
    }

    loadCoalitions()
  }, [limit])

  if (loading) {
    return <div className="text-center py-4">Chargement...</div>
  }

  if (error) {
    return <div className="text-center py-4 text-red-600">Erreur: {error.message}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-3 px-4 font-bold text-gray-800">#</th>
            <th className="text-left py-3 px-4 font-bold text-gray-800">Nom</th>
            <th className="text-center py-3 px-4 font-bold text-gray-800">Membres</th>
            <th className="text-center py-3 px-4 font-bold text-gray-800">Transferts</th>
            <th className="text-right py-3 px-4 font-bold text-gray-800">Points</th>
          </tr>
        </thead>
        <tbody>
          {coalitions.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-600">
                Aucune coalition trouvée
              </td>
            </tr>
          ) : (
            coalitions.map((coalition, idx) => (
              <tr
                key={coalition.coalition_id}
                className={`border-b border-gray-200 ${
                  idx < 3
                    ? 'bg-gradient-to-r from-amber-50 to-yellow-50'
                    : idx % 2 === 0
                      ? 'bg-white'
                      : 'bg-gray-50'
                }`}
              >
                <td className="py-3 px-4 font-bold text-lg">
                  {idx === 0 && '🥇'}
                  {idx === 1 && '🥈'}
                  {idx === 2 && '🥉'}
                  {idx > 2 && `#${idx + 1}`}
                </td>
                <td className="py-3 px-4">
                  <p className="font-bold text-gray-800">{coalition.coalition_name}</p>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                    {coalition.total_members}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                    {coalition.total_transfers}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-bold text-orange-600">
                  {coalition.total_points_transferred.toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}



