type ProgressBarProps = {
  current: number
  target: number
  color?: 'emerald' | 'blue' | 'amber'
}

const colorClasses: Record<NonNullable<ProgressBarProps['color']>, string> = {
  emerald: 'from-emerald-400 to-emerald-600',
  blue: 'from-indigo-400 to-indigo-600',
  amber: 'from-amber-400 to-amber-500',
}

export function ProgressBar({ current, target, color = 'emerald' }: ProgressBarProps) {
  const safeTarget = Math.max(1, target)
  const percent = Math.max(0, Math.min(100, Math.round((current / safeTarget) * 100)))
  const isComplete = percent >= 100

  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorClasses[color]} transition-all duration-700 ease-out ${
            isComplete ? 'animate-pulse' : ''
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-right text-xs text-slate-500">{percent}%</div>
    </div>
  )
}
