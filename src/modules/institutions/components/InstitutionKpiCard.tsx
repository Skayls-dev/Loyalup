import { TrendingDown, TrendingUp } from 'lucide-react'

type InstitutionKpiCardProps = {
  label: string
  value: string
  delta?: number
  deltaLabel?: string
}

export function InstitutionKpiCard({ label, value, delta, deltaLabel }: InstitutionKpiCardProps) {
  const hasPositiveDelta = delta && delta > 0
  const hasNegativeDelta = delta && delta < 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        {delta !== undefined && delta !== 0 && (
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium ${
            hasPositiveDelta ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {hasPositiveDelta ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{Math.abs(delta).toFixed(1)}%</span>
          </div>
        )}
      </div>
      {deltaLabel && (
        <p className="mt-2 text-xs text-slate-500">{deltaLabel}</p>
      )}
    </div>
  )
}
