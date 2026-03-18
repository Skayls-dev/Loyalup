import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export interface ScanResult {
  points?: number
  points_credited?: number
  totalPoints?: number
  total_points?: number
  amount?: number
  montant?: number
  basePoints?: number
  base_points?: number
  bonusPoints?: number
  bonus_points?: number
  multiplier?: number
  networkName?: string
  network_name?: string
  merchantName?: string
  merchant_name?: string
  merchantEmoji?: string
  merchant_emoji?: string
  currentPoints?: number
  current_points?: number
  nextThreshold?: number
  next_threshold?: number
}

export interface ScanSuccessProps {
  result: ScanResult
  onReset: () => void
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function ScanSuccess({ result, onReset }: ScanSuccessProps) {
  const navigate = useNavigate()
  const [entered, setEntered] = useState(false)
  const [progressReady, setProgressReady] = useState(false)

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setEntered(true), 20)
    const progressTimer = window.setTimeout(() => setProgressReady(true), 140)

    return () => {
      window.clearTimeout(enterTimer)
      window.clearTimeout(progressTimer)
    }
  }, [])

  const multiplier = toNumber(result.multiplier, 1)
  const networkName = result.networkName || result.network_name || 'Réseau LoyalUp'
  const merchantName = result.merchantName || result.merchant_name || 'Marchand partenaire'
  const merchantEmoji = result.merchantEmoji || result.merchant_emoji || '🏪'

  const totalPoints = toNumber(result.points ?? result.points_credited ?? result.totalPoints ?? result.total_points, 0)
  const amount = toNumber(result.amount ?? result.montant, 0)
  const basePoints = toNumber(result.basePoints ?? result.base_points, Math.max(0, Math.round(totalPoints / Math.max(multiplier, 1))))
  const bonusPoints = toNumber(result.bonusPoints ?? result.bonus_points, Math.max(0, totalPoints - basePoints))

  const currentPoints = toNumber(result.currentPoints ?? result.current_points, totalPoints)
  const nextThreshold = Math.max(1, toNumber(result.nextThreshold ?? result.next_threshold, 1000))

  const progress = useMemo(() => Math.max(0, Math.min(100, Math.round((currentPoints / nextThreshold) * 100))), [currentPoints, nextThreshold])

  return (
    <section className="flex justify-center">
      <article
        className={`w-full max-w-[420px] rounded-[24px] border-[1.5px] border-[#9FE1CB] bg-white p-5 shadow-[0_10px_30px_rgba(31,41,55,0.08)] transition-all duration-[350ms] ${
          entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">🎉 Super scan !</span>
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            x{multiplier.toFixed(1)} {networkName}
          </span>
        </div>

        <div className="mt-4 flex justify-center">
          <div className="success-pop inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-4xl text-white shadow-[0_10px_24px_rgba(16,185,129,0.35)]">
            ✓
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="font-display text-4xl font-extrabold leading-none text-transparent bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-700 bg-clip-text">
            +{totalPoints.toLocaleString('fr-FR')}
          </p>
          <p className="mt-1 font-body text-sm text-gray-600">points crédités instantanément</p>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl">{merchantEmoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-sm font-semibold text-dark">{merchantName}</p>
            <p className="truncate font-body text-xs text-gray-500">{networkName}</p>
          </div>
          <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">x{multiplier.toFixed(1)}</span>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
            <span>{currentPoints.toLocaleString('fr-FR')} pts / {nextThreshold.toLocaleString('fr-FR')} pts</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-[800ms] ease-out"
              style={{ width: `${progressReady ? progress : 0}%` }}
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-3">
          <div className="space-y-1.5 font-body text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Montant dépensé:</span>
              <span>{amount.toLocaleString('fr-FR')}€</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Points de base:</span>
              <span>{basePoints.toLocaleString('fr-FR')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Bonus multiplicateur:</span>
              <span>+{bonusPoints.toLocaleString('fr-FR')}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-2 font-semibold">
              <span>Total:</span>
              <span className="text-emerald-600">+{totalPoints.toLocaleString('fr-FR')} pts</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onReset}
            className="h-11 rounded-md border border-gray-300 bg-transparent font-body text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ↩ Nouveau scan
          </button>
          <button
            type="button"
            onClick={() => navigate('/client')}
            className="h-11 rounded-md bg-primary font-body text-sm font-semibold text-white transition hover:brightness-105"
          >
            Voir mes points →
          </button>
        </div>

        <style>{`
          .success-pop {
            animation: success-pop-in 520ms cubic-bezier(0.17, 0.89, 0.32, 1.35) both;
          }

          @keyframes success-pop-in {
            0% {
              transform: scale(0.65);
              opacity: 0;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </article>
    </section>
  )
}
