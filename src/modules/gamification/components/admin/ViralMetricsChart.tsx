import type { ViralMetrics } from '../../services/networkService'

interface ViralMetricsChartProps {
  data: ViralMetrics[]
}

export function ViralMetricsChart({ data }: ViralMetricsChartProps) {
  const maxReferrers = Math.max(...data.map((d) => d.total_referrers), 1)

  return (
    <div className="space-y-6">
      {data.map((tier) => (
        <div key={tier.tier} className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-bold text-gray-800 mb-3">
            Niveau {tier.tier}: {tier.tier === 1 ? 'Parrains directs' : 'Parrains secondaires'}
          </h4>

          <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
            <div className="bg-blue-50 p-2 rounded border border-blue-200">
              <div className="font-semibold text-gray-700">Parrains</div>
              <div className="text-lg font-bold text-blue-600">{tier.total_referrers}</div>
            </div>
            <div className="bg-purple-50 p-2 rounded border border-purple-200">
              <div className="font-semibold text-gray-700">Parrainages</div>
              <div className="text-lg font-bold text-purple-600">{tier.total_referred}</div>
            </div>
            <div className="bg-green-50 p-2 rounded border border-green-200">
              <div className="font-semibold text-gray-700">Récompensés</div>
              <div className="text-lg font-bold text-green-600">{tier.total_rewarded_referrals}</div>
            </div>
            <div className="bg-orange-50 p-2 rounded border border-orange-200">
              <div className="font-semibold text-gray-700">Moy. par parrain</div>
              <div className="text-lg font-bold text-orange-600">{tier.avg_reward_per_referrer}XP</div>
            </div>
          </div>

          {/* Visual bar */}
          <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all"
              style={{
                width: `${(tier.total_referrers / maxReferrers) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}



