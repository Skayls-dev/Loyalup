import type { ReferralFunnel } from '../../services/networkService'

interface ReferralFunnelChartProps {
  data: ReferralFunnel[]
}

export function ReferralFunnelChart({ data }: ReferralFunnelChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="space-y-4">
      {data.map((item, idx) => {
        const width = (item.count / maxCount) * 100
        const colors = ['from-blue-500 to-blue-600', 'from-purple-500 to-purple-600', 'from-pink-500 to-pink-600']

        return (
          <div key={idx} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-800">{item.step}</span>
              <span className="text-xs font-bold text-gray-600">
                {item.count.toLocaleString()} ({item.conversion_from_previous}%)
              </span>
            </div>
            <div className="w-full h-10 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${colors[idx]} flex items-center justify-end pr-4 transition-all`}
                style={{ width: `${width}%` }}
              >
                {width > 15 && <span className="text-white font-bold text-sm">{item.count}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}



