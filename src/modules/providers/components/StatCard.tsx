import { memo, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type StatCardProps = {
  label: string
  value: number
  icon: ReactNode
  color: 'teal' | 'orange' | 'amber' | 'green'
  trend?: number
}

const glowClass: Record<StatCardProps['color'], string> = {
  teal: 'shadow-[0_0_24px_-14px_rgba(20,184,166,0.8)]',
  orange: 'shadow-[0_0_24px_-14px_rgba(249,115,22,0.8)]',
  amber: 'shadow-[0_0_24px_-14px_rgba(245,158,11,0.8)]',
  green: 'shadow-[0_0_24px_-14px_rgba(34,197,94,0.8)]',
}

function StatCardComponent({ label, value, icon, color, trend }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const start = 0
    const end = value
    const duration = 700
    const startedAt = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      setDisplayValue(Math.round(start + (end - start) * progress))

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [value])

  return (
    <article className={`rounded-2xl border border-zinc-700 bg-zinc-900/85 p-4 shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.015] motion-safe:hover:shadow-lg ${glowClass[color]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-600">
          {icon}
        </span>
      </div>

      <p className="mt-3 text-3xl font-black leading-none text-zinc-100">{displayValue.toLocaleString()}</p>

      {typeof trend === 'number' ? (
        <p className={`mt-2 text-xs font-semibold ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {trend >= 0 ? '↗' : '↘'} {trend > 0 ? '+' : ''}{trend}%
        </p>
      ) : null}
    </article>
  )
}

export const StatCard = memo(StatCardComponent)
