import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import {
  type MerchantRevenuePeriod,
  useMerchantRevenue,
} from '../../hooks/useMerchantRevenue'

export interface MerchantRevenueChartProps {
  merchantId: string
  className?: string
}

type TooltipPayload = {
  payload?: {
    label?: string
    revenue?: number
    pointsDistributed?: number
  }
}

const tabs: Array<{ label: string; value: MerchantRevenuePeriod }> = [
  { label: '7j', value: '7d' },
  { label: '30j', value: '30d' },
  { label: '90j', value: '90d' },
]

function RevenueTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) {
    return null
  }

  const first = payload[0] as TooltipPayload
  const label = first.payload?.label ?? ''
  const revenue = Number(first.payload?.revenue ?? 0)
  const points = Number(first.payload?.pointsDistributed ?? 0)

  return (
    <div className="rounded-sm border border-gray-200 bg-white px-3 py-2 shadow-floating" style={{ borderRadius: '8px' }}>
      <p className="font-body text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-display text-sm font-bold text-dark">{revenue.toLocaleString('fr-FR')} €</p>
      <p className="mt-1 font-body text-xs text-gray-600">{points.toLocaleString('fr-FR')} pts distribués</p>
    </div>
  )
}

export function MerchantRevenueChart({ merchantId, className = '' }: MerchantRevenueChartProps) {
  const [period, setPeriod] = useState<MerchantRevenuePeriod>('30d')
  const { data, loading, error } = useMerchantRevenue(merchantId, period)

  const chartKey = useMemo(() => `${period}-${data.length}`, [period, data.length])

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Revenu marchand</p>

        <div className="inline-flex rounded-full bg-gray-100 p-1">
          {tabs.map((tab) => {
            const active = tab.value === period
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setPeriod(tab.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  active ? 'bg-white text-dark shadow-floating' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart key={chartKey} data={data} margin={{ top: 6, right: 0, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="merchantRevenueLastBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B7FF5" stopOpacity={1} />
                <stop offset="100%" stopColor="#5B4FE8" stopOpacity={1} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9098B3', fontSize: 11, fontFamily: 'var(--font-body)' }}
            />
            <YAxis axisLine={false} tickLine={false} tick={false} width={0} />

            <Tooltip cursor={false} content={<RevenueTooltip />} />

            <Bar
              dataKey="revenue"
              radius={[8, 8, 0, 0]}
              animationBegin={80}
              animationDuration={600}
              isAnimationActive
            >
              {data.map((entry, index) => (
                <Cell
                  key={`${entry.key}-${index}`}
                  fill={entry.isLatest ? 'url(#merchantRevenueLastBar)' : '#5B4FE8'}
                  fillOpacity={entry.isLatest ? 1 : 0.18}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {loading ? <p className="mt-2 font-body text-xs text-gray-500">Chargement...</p> : null}
      {error ? <p className="mt-2 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
