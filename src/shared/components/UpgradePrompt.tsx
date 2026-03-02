import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { startProviderTrial } from '../services/subscriptionService'

type UpgradePromptProps = {
  feature: string
  tier_required: 'starter' | 'premium' | 'enterprise'
}

export function UpgradePrompt({ feature, tier_required }: UpgradePromptProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isStartingTrial, setIsStartingTrial] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleStartTrial = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsStartingTrial(true)

    try {
      await startProviderTrial()
      await queryClient.invalidateQueries({ queryKey: ['provider-tier', user?.id] })
      setSuccessMessage('Essai premium activé pour 14 jours.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Activation de l’essai impossible'
      setErrorMessage(message)
    } finally {
      setIsStartingTrial(false)
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-zinc-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-900/90 p-5 text-zinc-100">
        <h3 className="text-lg font-semibold">Fonctionnalité verrouillée</h3>
        <p className="mt-1 text-sm text-zinc-300">
          {feature} nécessite le plan {tier_required}.
        </p>

        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p>Starter: €9/mois → 500 clients + analytics de base</p>
          <p>Premium: €29/mois → illimité + deep analytics + benchmarks</p>
          <p>Enterprise: sur devis → white label + API + raw data</p>
        </div>

        <button
          type="button"
          onClick={handleStartTrial}
          disabled={isStartingTrial}
          className="mt-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          {isStartingTrial ? 'Activation en cours…' : 'Commencer l’essai gratuit 14 jours'}
        </button>

        {successMessage ? <p className="mt-3 text-xs text-emerald-400">{successMessage}</p> : null}
        {errorMessage ? <p className="mt-3 text-xs text-rose-400">{errorMessage}</p> : null}
      </div>
    </div>
  )
}
