import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export type ChallengeStatus = 'active' | 'completed' | 'available'

export type Challenge = {
  id: string
  name: string
  description: string
  icon: string
  bgColor: string
  rewardPoints: number
  progress: number
  target: number
  deadline?: string
  status: ChallengeStatus
  featured?: boolean
}

export type ChallengeCardProps = {
  challenge: Challenge
}

type ChallengeTab = 'active' | 'completed' | 'available'

type ChallengesSectionProps = {
  challenges: Challenge[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toPercent(progress: number, target: number) {
  if (target <= 0) return 0
  return clamp((progress / target) * 100, 0, 100)
}

function formatDeadline(deadline?: string) {
  if (!deadline) return null
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function cardClassName(challenge: Challenge) {
  if (challenge.status === 'completed') {
    return 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white'
  }

  if (challenge.status === 'active' && challenge.featured) {
    return 'border-violet-300 bg-gradient-to-br from-violet-50 to-white'
  }

  return 'border-slate-200 bg-white'
}

function progressColor(challenge: Challenge) {
  if (challenge.status === 'completed') return 'linear-gradient(90deg, #22C55E, #16A34A)'
  if (challenge.status === 'active' && challenge.featured) {
    return 'linear-gradient(90deg, #7C3AED, #A78BFA)'
  }
  return 'linear-gradient(90deg, #8B5CF6, #C4B5FD)'
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const [animateProgress, setAnimateProgress] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setAnimateProgress(true)
    })

    return () => {
      window.cancelAnimationFrame(id)
    }
  }, [])

  const percent = useMemo(() => toPercent(challenge.progress, challenge.target), [challenge.progress, challenge.target])
  const isCompleted = challenge.status === 'completed'
  const isAvailable = challenge.status === 'available'
  const deadlineLabel = challenge.status === 'active' ? formatDeadline(challenge.deadline) : null

  return (
    <article className={`rounded-2xl border p-4 shadow-sm transition ${cardClassName(challenge)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: challenge.bgColor }}
            aria-hidden="true"
          >
            {challenge.icon}
          </div>

          <div className="min-w-0">
            <p className="font-display text-base font-bold text-slate-900">{challenge.name}</p>
            <p className="mt-1 font-body text-sm text-slate-600">{challenge.description}</p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className={`font-display text-xl font-extrabold ${isCompleted ? 'text-emerald-600' : 'text-violet-600'}`}>
            +{challenge.rewardPoints}
          </p>
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">pts</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {isCompleted ? (
          <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            ✓ Fait
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-500">
            {challenge.progress} / {challenge.target}
          </span>
        )}

        {!isAvailable ? (
          <span className={`text-xs font-semibold ${isCompleted ? 'text-emerald-600' : 'text-violet-600'}`}>
            {Math.round(percent)}%
          </span>
        ) : null}
      </div>

      {!isAvailable ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full"
            style={{
              width: `${animateProgress ? percent : 0}%`,
              background: progressColor(challenge),
              transition: 'width 700ms ease-out',
            }}
            aria-hidden="true"
          />
        </div>
      ) : null}

      {deadlineLabel ? (
        <div className="mt-3">
          <span className="inline-flex rounded-full border border-orange-300 bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
            ⏳ Échéance {deadlineLabel}
          </span>
        </div>
      ) : null}
    </article>
  )
}

function tabLabel(tab: ChallengeTab) {
  if (tab === 'active') return 'En cours'
  if (tab === 'completed') return 'Terminés'
  return 'Disponibles'
}

export default function ChallengesSection({ challenges }: ChallengesSectionProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ChallengeTab>('active')

  const byTab = useMemo(() => {
    const active = challenges.filter((c) => c.status === 'active')
    const completed = challenges.filter((c) => c.status === 'completed')
    const available = challenges.filter((c) => c.status === 'available')
    return { active, completed, available }
  }, [challenges])

  const visible = byTab[activeTab]

  return (
    <section className="space-y-4">
      <div className="inline-flex rounded-full bg-slate-200 p-1">
        {(['active', 'completed', 'available'] as ChallengeTab[]).map((tab) => {
          const selected = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                selected
                  ? 'bg-white text-slate-900 shadow-[0_3px_10px_rgba(15,23,42,0.18)]'
                  : 'text-slate-600 hover:text-slate-800',
              ].join(' ')}
            >
              {tabLabel(tab)}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Aucun défi dans cet onglet.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visible.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))}

        {activeTab === 'active' ? (
          <button
            type="button"
            onClick={() => navigate('/challenges')}
            className="flex min-h-[176px] items-center justify-center rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/30 p-4 text-center text-violet-700 transition hover:bg-violet-100/40"
          >
            <span className="font-display text-lg font-bold">+ Découvrir plus de défis</span>
          </button>
        ) : null}
      </div>
    </section>
  )
}
