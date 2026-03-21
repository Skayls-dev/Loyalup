import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { BonusBreakdown } from '../../networks/components/client'

type TransactionSuccessProps = {
  clientName: string
  serviceName: string
  montant: number
  basePoints: number
  pointsCredited: number
  newBalance: number
  networkBonuses: Array<{ network_name: string; emoji: string; bonus: number }>
  onDismiss: () => void
}

export function TransactionSuccess({
  clientName,
  serviceName,
  montant,
  basePoints,
  pointsCredited,
  newBalance,
  networkBonuses,
  onDismiss,
}: TransactionSuccessProps) {
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      onDismiss()
    }, 3000)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [onDismiss])

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/95 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100 shadow-2xl">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            aria-label="Fermer et revenir au QR code"
          >
            Fermer
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="animate-[scaleIn_320ms_ease-out] rounded-full bg-emerald-500/15 p-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-400" />
          </div>

          <h3 className="mt-4 text-2xl font-bold">Transaction validée</h3>
          <p className="mt-1 text-sm text-zinc-400">{clientName}</p>

          <div className="mt-5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left">
            <p className="text-sm text-zinc-400">Service</p>
            <p className="font-semibold">{serviceName}</p>

            <p className="mt-3 text-sm text-zinc-400">Montant</p>
            <p className="font-semibold">{montant.toFixed(2)}€</p>
          </div>

          <p className="mt-5 text-4xl font-extrabold text-amber-400">+{pointsCredited} pts</p>
          <p className="mt-2 text-sm text-zinc-300">Nouveau solde: {newBalance} pts</p>

          <button
            type="button"
            onClick={onDismiss}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Retour au QR code
          </button>
        </div>
      </div>

      {networkBonuses.length > 0 ? (
        <BonusBreakdown
          open
          base_points={basePoints}
          total_points={pointsCredited}
          network_bonuses={networkBonuses}
          onClose={onDismiss}
        />
      ) : null}
    </div>
  )
}
