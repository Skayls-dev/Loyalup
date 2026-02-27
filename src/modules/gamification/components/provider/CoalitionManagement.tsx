import { useState, useEffect } from 'react'
import { getCoalitionMembers, getCoalitionStats, suspendCoalitionMember, removeCoalitionMember } from '../../services/networkService'

interface CoalitionManagementProps {
  coalitionId: string
}

export function CoalitionManagement({ coalitionId }: CoalitionManagementProps) {
  const [members, setMembers] = useState<Array<any>>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [membersData, statsData] = await Promise.all([
          getCoalitionMembers(coalitionId),
          getCoalitionStats(coalitionId),
        ])
        setMembers(membersData)
        setStats(statsData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load data'))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [coalitionId])

  const handleSuspend = async (memberId: string) => {
    try {
      await suspendCoalitionMember(memberId)
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, status: 'suspended' } : m)),
      )
    } catch (err) {
      console.error('Failed to suspend member:', err)
    }
  }

  const handleRemove = async (memberId: string) => {
    try {
      await removeCoalitionMember(memberId)
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, status: 'left' } : m)),
      )
    } catch (err) {
      console.error('Failed to remove member:', err)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Chargement des données...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Erreur: {error.message}</div>
  }

  const activeMembers = members.filter((m) => m.status === 'active')

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{stats.total_members}</div>
            <div className="text-xs text-blue-700 font-semibold">Membres totaux</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.active_members}</div>
            <div className="text-xs text-green-700 font-semibold">Membres actifs</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{stats.total_transfers}</div>
            <div className="text-xs text-purple-700 font-semibold">Transferts</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">
              {stats.total_points_transferred.toLocaleString()}
            </div>
            <div className="text-xs text-orange-700 font-semibold">Points transférés</div>
          </div>
        </div>
      )}

      {/* Members List */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4">👥 Membres de la coalition</h3>

        {activeMembers.length === 0 ? (
          <div className="text-center py-8 text-gray-600">Aucun membre actif</div>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            {activeMembers.map((member) => (
              <div
                key={member.id}
                className="p-4 bg-white rounded-lg border border-gray-200 flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-gray-800">{member.provider_name}</h4>
                  <p className="text-xs text-gray-600">
                    Rejoint le {new Date(member.joined_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSuspend(member.id)}
                    className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded font-semibold hover:bg-yellow-200 transition-colors"
                  >
                    ⏸ Suspendre
                  </button>
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded font-semibold hover:bg-red-200 transition-colors"
                  >
                    ✕ Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {members.length > activeMembers.length && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <details className="cursor-pointer">
              <summary className="font-semibold text-gray-700">
                Autres members ({members.length - activeMembers.length})
              </summary>
              <div className="mt-3 space-y-2">
                {members
                  .filter((m) => m.status !== 'active')
                  .map((member) => (
                    <div
                      key={member.id}
                      className="p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-700">{member.provider_name}</p>
                          <p className="text-xs text-gray-600">
                            Status: {member.status === 'suspended' ? '⏸ Suspendu' : '✕ Parti'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}



