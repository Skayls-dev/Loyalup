type UpgradePromptProps = {
  feature: string
  tier_required: 'starter' | 'premium' | 'enterprise'
}

export function UpgradePrompt({ feature, tier_required }: UpgradePromptProps) {
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
          className="mt-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          Commencer l’essai gratuit 14 jours
        </button>
      </div>
    </div>
  )
}
