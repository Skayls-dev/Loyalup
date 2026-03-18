import { Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export interface TierCardProps {
  totalPoints: number
  currentTier?: string
  currentTierEmoji?: string
  nextTier?: string
  currentTierThreshold?: number
  nextTierThreshold: number
  className?: string
}

export function TierCard({
  totalPoints,
  currentTier = 'Gold',
  currentTierEmoji = '⭐',
  nextTier = 'Platinum',
  currentTierThreshold = 0,
  nextTierThreshold,
  className = '',
}: TierCardProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const { progressPercent, remainingPoints } = useMemo(() => {
    const denominator = Math.max(1, nextTierThreshold - currentTierThreshold)
    const progress = ((totalPoints - currentTierThreshold) / denominator) * 100
    return {
      progressPercent: Math.max(0, Math.min(100, Math.round(progress))),
      remainingPoints: Math.max(0, nextTierThreshold - totalPoints),
    }
  }, [totalPoints, currentTierThreshold, nextTierThreshold])

  return (
    <article
      className={`rounded-lg border border-white/10 bg-gradient-to-br from-[#0A0A0F] to-[#1A1040] p-5 text-white shadow-card ${className}`}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD23F]/30 bg-[#FFD23F]/10 px-3 py-1 text-xs font-semibold text-[#FFD23F]">
        {currentTier} {currentTierEmoji}
      </div>

      <p className="mt-4 font-display text-[2.2rem] font-extrabold leading-none">{totalPoints.toLocaleString('fr-FR')}</p>

      <div className="mt-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-[#FFD23F] transition-[width] duration-700 ease-out"
            style={{ width: `${mounted ? progressPercent : 0}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-white/75">
          <span>
            {totalPoints.toLocaleString('fr-FR')} pts / {nextTierThreshold.toLocaleString('fr-FR')} pts
          </span>
          <span>{progressPercent}%</span>
        </div>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 text-sm text-white/85">
        <Sparkles className="h-4 w-4 text-[#FFD23F]" />
        <span>Encore {remainingPoints.toLocaleString('fr-FR')} pts pour niveau {nextTier}</span>
      </div>
    </article>
  )
}
