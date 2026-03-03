import { useEffect, useMemo, useState } from 'react'

type BonusBreakdownItem = {
  network_name: string
  emoji: string
  bonus: number
}

type BonusBreakdownProps = {
  open: boolean
  base_points: number
  total_points: number
  network_bonuses: BonusBreakdownItem[]
  onClose: () => void
}

export function BonusBreakdown({ open, base_points, total_points, network_bonuses, onClose }: BonusBreakdownProps) {
  const [animatedBase, setAnimatedBase] = useState(0)
  const [animatedTotal, setAnimatedTotal] = useState(0)

  const totalBonus = useMemo(
    () => network_bonuses.reduce((sum, row) => sum + Number(row.bonus ?? 0), 0),
    [network_bonuses],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    const startedAt = performance.now()
    const duration = 600

    let raf = 0

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      setAnimatedBase(Math.floor(base_points * progress))
      setAnimatedTotal(Math.floor(total_points * progress))

      if (progress < 1) {
        raf = requestAnimationFrame(animate)
      }
    }

    raf = requestAnimationFrame(animate)

    const timeout = window.setTimeout(onClose, 4000)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timeout)
    }
  }, [base_points, onClose, open, total_points])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-3 z-50 mx-auto w-[min(96%,420px)] animate-[slideInUp_250ms_ease-out] rounded-2xl border border-white/70 bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur">
      <p className="text-sm font-semibold text-emerald-600">✅ +{animatedTotal} points gagnés</p>

      <div className="mt-3 space-y-1 text-sm">
        <Row label="Base" value={`${animatedBase} pts`} />
        {network_bonuses.map((bonus) => (
          <Row key={`${bonus.network_name}-${bonus.emoji}`} label={`${bonus.emoji} ${bonus.network_name} bonus`} value={`+${bonus.bonus} pts`} />
        ))}
        <div className="my-1 h-px w-full bg-slate-200" />
        <Row label="Total" value={`${animatedTotal} pts ✦`} strong />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
      >
        Voir mes réseaux
      </button>

      {totalBonus <= 0 ? null : <p className="mt-2 text-center text-[11px] text-slate-500">Bonus réseau total: +{totalBonus} pts</p>}
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={strong ? 'font-semibold text-slate-900' : 'text-slate-600'}>{label}</span>
      <span className={strong ? 'font-semibold text-amber-700' : 'text-slate-700'}>{value}</span>
    </div>
  )
}
