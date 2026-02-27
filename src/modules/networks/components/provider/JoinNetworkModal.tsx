import { useMemo, useState } from 'react'
import { requestJoinNetwork } from '../../services/networkService'
import type { Network } from '../../types/networkTypes'

type JoinNetworkModalProps = {
  network: Network
  onClose: () => void
  onSuccess: () => void
}

export function JoinNetworkModal({ network, onClose, onSuccess }: JoinNetworkModalProps) {
  const [step, setStep] = useState(1)
  const [requestMessage, setRequestMessage] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checks = useMemo(
    () => [
      { label: 'Niveau d’abonnement requis', ok: true },
      { label: 'Zone géographique requise', ok: true },
      { label: 'Catégorie requise', ok: true },
      { label: 'Nombre minimum de clients', ok: true },
    ],
    [],
  )

  const hasFailedChecks = checks.some((item) => !item.ok)

  const submitRequest = async () => {
    try {
      setSubmitting(true)
      setError(null)

      await requestJoinNetwork(
        network.id,
        network.membership_type === 'validated'
          ? requestMessage
          : network.membership_type === 'invite_only'
            ? `invite_code:${inviteCode}`
            : undefined,
      )

      onSuccess()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Impossible d’envoyer la demande')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4">
      <section className="w-full max-w-xl space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-100">
        <header className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Rejoindre {network.name.fr ?? network.slug}</h3>
          <button type="button" onClick={onClose} className="rounded bg-zinc-800 px-2 py-1 text-xs">
            Fermer
          </button>
        </header>

        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className={`rounded py-1 text-center text-xs ${step === item ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-800 text-zinc-400'}`}>
              {item}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Étape 1 — Vérification des conditions</h4>
            <div className="space-y-1">
              {checks.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded border border-zinc-800 px-2 py-1 text-xs">
                  <span>{item.label}</span>
                  <span className={item.ok ? 'text-emerald-300' : 'text-red-300'}>{item.ok ? '✓' : '✗'}</span>
                </div>
              ))}
            </div>
            {hasFailedChecks ? (
              <p className="text-xs text-amber-300">Certaines conditions ne sont pas remplies.</p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Étape 2 — Message</h4>
            {network.membership_type === 'validated' ? (
              <>
                <textarea
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value.slice(0, 500))}
                  rows={5}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  placeholder="Présentez votre activité au réseau"
                />
                <p className="text-xs text-zinc-500">{requestMessage.length}/500</p>
              </>
            ) : (
              <p className="text-xs text-zinc-400">Aucun message requis pour ce type d’adhésion.</p>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Étape 3 — Code d’invitation</h4>
            {network.membership_type === 'invite_only' ? (
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                placeholder="Code requis"
              />
            ) : (
              <p className="text-xs text-zinc-400">Aucun code requis pour ce réseau.</p>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Étape 4 — Confirmation</h4>
            <p className="text-xs text-zinc-300">Réseau: {network.emoji} {network.name.fr ?? network.slug}</p>
            <p className="text-xs text-zinc-300">Multiplicateur: {network.points_multiplier.toFixed(2)}x</p>
            <p className="text-xs text-zinc-500">Activation estimée: sous 24h.</p>
          </div>
        ) : null}

        {error ? <p className="text-xs text-red-300">{error}</p> : null}

        <footer className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((value) => Math.max(1, value - 1))}
            disabled={step === 1}
            className="rounded bg-zinc-800 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Précédent
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((value) => Math.min(4, value + 1))}
              className="rounded bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700"
            >
              Continuer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void submitRequest()
              }}
              disabled={submitting}
              className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-60"
            >
              {submitting ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
