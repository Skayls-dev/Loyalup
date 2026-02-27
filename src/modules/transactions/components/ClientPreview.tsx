import { useEffect, useMemo, useState } from 'react'
import type { PendingTransactionPayload } from '../../qr/services/qrService'
import type { Profile } from '../../../shared/types'

type ClientPreviewProps = {
  clientProfile: Profile | null
  clientPoints: number
  totalVisites: number
  pendingTransaction: PendingTransactionPayload | null
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function ClientPreview({
  clientProfile,
  clientPoints,
  totalVisites,
  pendingTransaction,
}: ClientPreviewProps) {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!pendingTransaction?.expires_at) {
      setSecondsLeft(0)
      return
    }

    const compute = () => {
      const diffMs = new Date(pendingTransaction.expires_at).getTime() - Date.now()
      setSecondsLeft(Math.max(0, Math.ceil(diffMs / 1000)))
    }

    compute()
    const intervalId = window.setInterval(compute, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pendingTransaction?.expires_at])

  const initial = useMemo(
    () => (clientProfile?.nom?.trim()?.charAt(0)?.toUpperCase() || 'C'),
    [clientProfile?.nom],
  )

  const memberSince = useMemo(() => {
    if (!clientProfile?.created_at) {
      return 'N/A'
    }

    return new Date(clientProfile.created_at).toLocaleDateString()
  }, [clientProfile?.created_at])

  const countdownClass = secondsLeft < 60 ? 'text-red-400' : 'text-zinc-300'

  return (
    <section className="animate-[fadeIn_240ms_ease-out] rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-lg font-bold text-zinc-100">
          {initial}
        </div>

        <div>
          <h3 className="text-base font-semibold">{clientProfile?.nom || 'Client inconnu'}</h3>
          <p className="text-xs text-zinc-400">Membre depuis {memberSince}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-400">Solde actuel</p>
          <p className="mt-1 text-xl font-bold text-amber-400">{clientPoints} pts</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-400">Visites</p>
          <p className="mt-1 inline-flex rounded-full bg-zinc-800 px-2 py-1 text-sm font-semibold text-zinc-200">
            {totalVisites}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
        <p className={`text-sm font-medium ${countdownClass}`}>
          Transaction expire dans {formatCountdown(secondsLeft)}
        </p>
      </div>
    </section>
  )
}
