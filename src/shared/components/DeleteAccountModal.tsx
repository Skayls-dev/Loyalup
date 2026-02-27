import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type DeleteAccountModalProps = {
  open: boolean
  onClose: () => void
}

export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  if (!open) {
    return null
  }

  const canSubmit = confirmText.trim().toUpperCase() === 'SUPPRIMER'

  const handleDelete = async () => {
    if (!canSubmit || loading) {
      return
    }

    setLoading(true)
    setStatus('Suppression en cours...')

    try {
      const { data, error } = await supabase.functions.invoke('delete-user-data')
      if (error) {
        throw error
      }

      const steps = Array.isArray(data?.steps_completed) ? data.steps_completed.join(', ') : 'n/a'
      setStatus(`Suppression terminée. Étapes: ${steps}`)

      window.setTimeout(() => {
        window.location.href = '/auth'
      }, 1200)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Impossible de supprimer le compte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 px-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-100">
        <h3 className="text-lg font-semibold">Supprimer mon compte</h3>
        <p className="mt-2 text-sm text-zinc-300">Cette action est irréversible.</p>

        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-400">
          <li>Profil et consentements</li>
          <li>Points, récompenses, notifications</li>
          <li>Données personnelles liées au compte</li>
        </ul>

        <label className="mt-4 block text-xs text-zinc-400">Tapez SUPPRIMER pour confirmer</label>
        <input
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          placeholder="SUPPRIMER"
        />

        {status ? <p className="mt-3 text-xs text-zinc-400">{status}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canSubmit || loading}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-70"
          >
            Supprimer définitivement
          </button>
        </div>
      </div>
    </div>
  )
}
