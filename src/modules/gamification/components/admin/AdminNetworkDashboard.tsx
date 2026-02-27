import { useState, useEffect } from 'react'
import {
  getNetworkStats,
  getViralMetrics,
  getReferralFunnel,
  getCoalitionLeaderboard,
  subscribeReferralRealtime,
} from '../../services/networkService'
import type { NetworkStats, ViralMetrics, ReferralFunnel } from '../../services/networkService'
import { StatsCard } from './StatsCard'
import { ReferralFunnelChart } from './ReferralFunnelChart'
import { ViralMetricsChart } from './ViralMetricsChart'
import { TopReferrersList } from './TopReferrersList'
import { CoalitionLeaderboard } from './CoalitionLeaderboard'
import { CoalitionNetworkGraph } from './CoalitionNetworkGraph'

export function AdminNetworkDashboard() {
  const [stats, setStats] = useState<NetworkStats | null>(null)
  const [viralMetrics, setViralMetrics] = useState<ViralMetrics[]>([])
  const [funnelData, setFunnelData] = useState<ReferralFunnel[]>([])
  const [networkData, setNetworkData] = useState<Array<{
    coalition_id: string
    coalition_name: string
    total_members: number
    total_transfers: number
    total_points_transferred: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [statsData, viralData, funnel, coalitions] = await Promise.all([
          getNetworkStats(),
          getViralMetrics(),
          getReferralFunnel(),
          getCoalitionLeaderboard(20),
        ])
        setStats(statsData)
        setViralMetrics(viralData)
        setFunnelData(funnel)
        setNetworkData(coalitions)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load data'))
      } finally {
        setLoading(false)
      }
    }

    loadData()

    const unsubscribe = subscribeReferralRealtime(() => {
      loadData().catch(() => undefined)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  if (loading) {
    return <div className="text-center py-12">Chargement du dashboard...</div>
  }

  if (error) {
    return <div className="text-center py-12 text-red-600">Erreur: {error.message}</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">📊 Dashboard Réseau & Viral</h1>
        <p className="text-gray-600">Analytique complète du système de parrainage et des coalitions</p>
      </div>

      {/* Main Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <StatsCard
            icon="👥"
            label="Total Clients"
            value={stats.total_clients.toLocaleString()}
            color="blue"
            trend={{ direction: 'up', percent: 12 }}
          />
          <StatsCard
            icon="✨"
            label="Clients Actifs"
            value={stats.active_clients.toLocaleString()}
            color="green"
            trend={{ direction: 'up', percent: 8 }}
          />
          <StatsCard
            icon="🏅"
            label="Badges Gagnés"
            value={stats.total_badges_earned.toLocaleString()}
            color="purple"
            trend={{ direction: 'up', percent: 25 }}
          />
          <StatsCard
            icon="💰"
            label="Points Transférés"
            value={stats.total_points_transferred.toLocaleString()}
            color="orange"
            trend={{ direction: 'up', percent: 15 }}
          />
          <StatsCard
            icon="👫"
            label="Parrainages Activés"
            value={stats.total_referrals.toLocaleString()}
            color="red"
            trend={{ direction: 'up', percent: 32 }}
          />
          <StatsCard
            icon="🧪"
            label="Viral K"
            value={stats.viral_k_factor.toFixed(3)}
            color="purple"
          />
        </div>
      )}

      {/* Conversion Rate */}
      {stats && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border-2 border-indigo-200">
          <h3 className="font-bold text-gray-800 mb-3">📈 Taux de Conversion Parrainage</h3>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-4xl font-bold text-indigo-600">
                {stats.referral_conversion_rate.toFixed(1)}%
              </div>
              <p className="text-sm text-gray-700">Codes activés / Codes générés</p>
            </div>
            <div className="flex-1 h-16 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all"
                style={{ width: `${stats.referral_conversion_rate}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Referral Funnel */}
        <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">🔗 Entonnoir de Parrainage</h2>
          {funnelData.length > 0 ? (
            <ReferralFunnelChart data={funnelData} />
          ) : (
            <div className="text-center py-8 text-gray-600">Aucune donnée disponible</div>
          )}
        </div>

        {/* Viral Metrics */}
        <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">🦠 Métriques Virales</h2>
          {viralMetrics.length > 0 ? (
            <ViralMetricsChart data={viralMetrics} />
          ) : (
            <div className="text-center py-8 text-gray-600">Aucune donnée disponible</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">🌐 Réseau de coalitions providers</h2>
        <CoalitionNetworkGraph coalitions={networkData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Referrers */}
        <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">🌟 Meilleurs Parrains</h2>
          <TopReferrersList limit={10} />
        </div>

        {/* Coalition Leaderboard */}
        <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">🤝 Classement des Coalitions</h2>
          <CoalitionLeaderboard limit={10} />
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
          <h4 className="font-bold text-gray-800 mb-2">💡 Insight 1</h4>
          <p className="text-sm text-gray-700">
            {stats && stats.referral_conversion_rate > 20
              ? '✅ Excellent taux de conversion! Continuez à promouvoir le programme.'
              : '⚠️ Taux de conversion faible. Envisagez d\'augmenter les incitations.'}
          </p>
        </div>

        <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
          <h4 className="font-bold text-gray-800 mb-2">💡 Insight 2</h4>
          <p className="text-sm text-gray-700">
            {stats && stats.active_clients > stats.total_clients * 0.5
              ? '✅ Engagement client excellent. L\'engagement est au-dessus de la médiane.'
              : '⚠️ Faible engagement. Considérez des campagnes de réactivation.'}
          </p>
        </div>

        <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-lg">
          <h4 className="font-bold text-gray-800 mb-2">💡 Insight 3</h4>
          <p className="text-sm text-gray-700">
            {stats && stats.total_points_transferred > 10000
              ? '✅ Forte adoption du marketplace! Les coalitions sont actives.'
              : '⚠️ Faible adoption du marketplace. Développez les coalitions.'}
          </p>
        </div>
      </div>
    </div>
  )
}



