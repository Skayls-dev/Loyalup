import { useEffect, useMemo, useState } from 'react'

type ProgressColor = 'primary' | 'success' | 'warning' | 'info'

export interface ProgressBarProps {
  value: number
  showLabel?: boolean
  color?: ProgressColor
  className?: string
}

const colorClasses: Record<ProgressColor, string> = {
  primary: 'bg-primary',
  success: 'bg-accent-green',
  warning: 'bg-accent-yellow',
  info: 'bg-sky-500',
}

export function ProgressBar({ value, showLabel = false, color = 'primary', className = '' }: ProgressBarProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const clampedValue = useMemo(() => Math.max(0, Math.min(100, value)), [value])

  return (
    <div className={`w-full ${className}`}>
      {showLabel ? (
        <div className="mb-2 flex items-center justify-between text-xs font-body text-gray-600">
          <span>Progress</span>
          <span className="font-medium text-gray-800">{Math.round(clampedValue)}%</span>
        </div>
      ) : null}

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${colorClasses[color]}`}
          style={{ width: `${mounted ? clampedValue : 0}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clampedValue)}
        />
      </div>
    </div>
  )
}
