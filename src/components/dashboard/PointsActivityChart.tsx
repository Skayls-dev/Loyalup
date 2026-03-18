import type { CSSProperties } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import type { TooltipProps } from 'recharts'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { usePointsHistory } from '../../hooks/usePointsHistory'

type PointsActivityChartProps = {
  userId?: string
  weeks?: number
  className?: string
}

type TooltipPayloadItem = {
  payload?: {
    week?: string
    points?: number
  }
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) {
    return null
  }

  const first = payload[0] as TooltipPayloadItem
  const weekLabel = first?.payload?.week ?? ''
  const points = Number(first?.payload?.points ?? 0)

  return (
    <div
      className="rounded-sm border border-gray-200 bg-white px-3 py-2 shadow-floating"
      style={{ borderRadius: '8px' } as CSSProperties}
    >
      <p className="font-body text-xs text-gray-500">Semaine {weekLabel}</p>
      <p className="mt-1 font-display text-sm font-bold text-dark">{points.toLocaleString('fr-FR')} pts</p>
    </div>
  )
}

export function PointsActivityChart({ userId, weeks = 8, className = '' }: PointsActivityChartProps) {
  const { user } = useAuth()
  const resolvedUserId = userId ?? user?.id
  const { data, loading, error } = usePointsHistory(resolvedUserId, weeks)

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Activite points</p>
        {loading ? <span className="font-body text-xs text-gray-400">Chargement...</span> : null}
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="pointsLastBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5B4FE8" stopOpacity={1} />
                <stop offset="100%" stopColor="#8B7FF5" stopOpacity={1} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9098B3', fontSize: 11, fontFamily: 'var(--font-body)' }}
            />
            <YAxis axisLine={false} tickLine={false} tick={false} width={0} />

            <Tooltip cursor={false} content={<CustomTooltip />} />

            <Bar
              dataKey="points"
              radius={[8, 8, 0, 0]}
              animationBegin={120}
              animationDuration={820}
              isAnimationActive
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.week}-${index}`}
                  fill={entry.isLatest ? 'url(#pointsLastBar)' : '#5B4FE8'}
                  fillOpacity={entry.isLatest ? 1 : 0.2}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {error ? <p className="mt-2 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
