import { useEffect, useRef, useState } from 'react'

type PointsBalanceProps = {
  points: number
  previousPoints: number
  color?: 'emerald' | 'blue' | 'amber'
}

const glowClasses: Record<NonNullable<PointsBalanceProps['color']>, string> = {
  emerald: 'border-emerald-200 bg-emerald-50/70',
  blue: 'border-indigo-200 bg-indigo-50/70',
  amber: 'border-amber-200 bg-amber-50/70',
}

export function PointsBalance({ points, previousPoints, color = 'emerald' }: PointsBalanceProps) {
  const [displayPoints, setDisplayPoints] = useState(previousPoints)
  const [delta, setDelta] = useState(0)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const start = previousPoints
    const end = points
    const diff = end - start
    const duration = 800
    const startTime = performance.now()

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration)
      const value = Math.round(start + diff * progress)
      setDisplayPoints(value)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick)
      }
    }

    setDelta(diff)
    animationRef.current = requestAnimationFrame(tick)

    const timer = window.setTimeout(() => setDelta(0), 1200)

    return () => {
      window.clearTimeout(timer)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [points, previousPoints])

  return (
    <div className={`rounded-xl border px-4 py-3 ${glowClasses[color]}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">Solde</p>
      <div className="flex items-end gap-3">
        <p className="text-4xl font-black leading-none text-slate-900">{displayPoints}</p>
        <span className="pb-1 text-sm text-slate-500">pts</span>
      </div>
      {delta > 0 ? <p className="mt-1 text-xs font-semibold text-emerald-600">+{delta} pts</p> : null}
    </div>
  )
}
