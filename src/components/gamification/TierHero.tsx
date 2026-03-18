import { useEffect, useMemo, useState } from 'react'

export type Tier = {
  name: string
  level: number
  minPoints: number
  icon: string
  color: string
}

type TierHeroProps = {
  tier: Tier
  points: number
  nextThreshold: number
}

type TierStep = {
  name: string
  level: number
  minPoints: number
  icon: string
}

type Milestone = {
  icon: string
  label: string
  threshold: number
}

const TIER_STEPS: TierStep[] = [
  { name: 'Bronze', level: 1, minPoints: 0, icon: '🥉' },
  { name: 'Silver', level: 2, minPoints: 1000, icon: '🥈' },
  { name: 'Gold', level: 3, minPoints: 5000, icon: '⭐' },
  { name: 'Platinum', level: 4, minPoints: 10000, icon: '💎' },
  { name: 'Diamond', level: 5, minPoints: 20000, icon: '👑' },
]

const MILESTONES: Milestone[] = [
  { icon: '🧭', label: 'Départ', threshold: 0 },
  { icon: '🔥', label: 'Momentum', threshold: 500 },
  { icon: '🥈', label: 'Silver', threshold: 1000 },
  { icon: '⭐', label: 'Gold', threshold: 5000 },
  { icon: '💎', label: 'Platinum', threshold: 10000 },
  { icon: '👑', label: 'Diamond', threshold: 20000 },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function TierHero({ tier, points, nextThreshold }: TierHeroProps) {
  const [animateProgress, setAnimateProgress] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setAnimateProgress(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [])

  const progressPercent = useMemo(() => {
    if (nextThreshold <= 0) return 100
    return clamp((points / nextThreshold) * 100, 0, 100)
  }, [nextThreshold, points])

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 p-5 text-white shadow-[0_20px_60px_rgba(10,10,20,0.38)]"
      style={{ background: 'linear-gradient(135deg, #0A0A0F, #1A1040, #2A1060)' }}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.42) 0%, rgba(139,92,246,0) 70%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-28 left-1/2 h-80 w-80 -translate-x-1/2"
        style={{ background: 'radial-gradient(circle, rgba(255,210,63,0.30) 0%, rgba(255,210,63,0) 72%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-[220px] space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Niveau actuel</p>
          <h2 className="font-display text-[2rem] font-extrabold leading-tight text-[#FFD23F]">{tier.name}</h2>
          <p
            className="font-display font-extrabold leading-none text-white"
            style={{ fontSize: '2.2rem' }}
          >
            {points.toLocaleString('fr-FR')} pts
          </p>
        </div>

        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {TIER_STEPS.map((item) => {
            const isCurrent = item.level === tier.level
            const isReached = item.level <= tier.level

            return (
              <div key={item.level} className="group relative text-center">
                <div
                  className={[
                    'relative flex h-14 w-14 items-center justify-center rounded-xl text-2xl transition-transform duration-200 group-hover:scale-110',
                    isCurrent
                      ? 'border border-[#FFD23F]/80 bg-[rgba(255,210,63,0.16)]'
                      : isReached
                        ? 'bg-[rgba(255,255,255,0.08)]'
                        : 'bg-[rgba(255,255,255,0.05)] grayscale opacity-30',
                  ].join(' ')}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {isReached ? (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
                      ✓
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] font-semibold text-white/80">{item.name}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="relative z-10 mt-5">
        <div className="h-[6px] overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full"
            style={{
              width: `${animateProgress ? progressPercent : 0}%`,
              background: 'linear-gradient(90deg, #8B5CF6, #FFD23F)',
              transition: 'width 1s ease-out',
            }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-6 gap-2">
        {MILESTONES.map((milestone) => {
          const reached = points >= milestone.threshold
          return (
            <div
              key={milestone.label}
              className="text-center transition-opacity"
              style={{ opacity: reached ? 1 : 0.4 }}
            >
              <p className="text-base" aria-hidden="true">
                {milestone.icon}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-white/85 sm:text-[11px]">{milestone.label}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
