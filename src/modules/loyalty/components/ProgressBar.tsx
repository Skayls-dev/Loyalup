type ProgressBarProps = {
  current: number
  target: number
  color?: 'emerald' | 'blue' | 'amber'
}

const colorClasses: Record<NonNullable<ProgressBarProps['color']>, string> = {
  emerald: 'from-zinc-700 to-emerald-500',
  blue: 'from-zinc-700 to-blue-500',
  amber: 'from-zinc-700 to-amber-500',
}

export function ProgressBar({ current, target, color = 'emerald' }: ProgressBarProps) {
  const safeTarget = Math.max(1, target)
  const percent = Math.max(0, Math.min(100, Math.round((current / safeTarget) * 100)))
  const isComplete = percent >= 100

  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorClasses[color]} transition-all duration-700 ease-out ${
            isComplete ? 'animate-pulse' : ''
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-right text-xs text-zinc-400">{percent}%</div>
    </div>
  )
}
