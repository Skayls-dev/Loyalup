
interface StatsCardProps {
  icon: string
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down'; percent: number }
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-green-50 text-green-600 border-green-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  red: 'bg-red-50 text-red-600 border-red-200',
}

export function StatsCard({
  icon,
  label,
  value,
  trend,
  color = 'blue',
}: StatsCardProps) {
  return (
    <div className={`p-6 rounded-lg border-2 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm font-semibold mt-1 text-gray-700">{label}</div>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>

      {trend && (
        <div className={`mt-3 text-xs font-semibold ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend.direction === 'up' ? '↑' : '↓'} {trend.percent}% ce mois
        </div>
      )}
    </div>
  )
}



