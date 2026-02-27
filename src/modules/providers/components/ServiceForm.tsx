import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ServiceItem } from '../services/providerService'

type ServiceFormData = {
  nom: string
  emoji: string
  prix_defaut: number | null
  points_defaut: number | null
  points_per_euro: number
}

type ServiceFormProps = {
  initialData?: ServiceItem | null
  onSubmit: (data: ServiceFormData) => Promise<void>
  onCancel: () => void
}

const secondaryButtonClass =
  'rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60'

export function ServiceForm({ initialData, onSubmit, onCancel }: ServiceFormProps) {
  const [nom, setNom] = useState(initialData?.nom ?? '')
  const [emoji, setEmoji] = useState(initialData?.emoji ?? '✨')
  const [prix, setPrix] = useState(initialData?.prix_defaut !== null && initialData?.prix_defaut !== undefined ? String(initialData.prix_defaut) : '')
  const [pointsDefaut, setPointsDefaut] = useState(initialData?.points_defaut !== null && initialData?.points_defaut !== undefined ? String(initialData.points_defaut) : '')
  const [pointsPerEuro, setPointsPerEuro] = useState(String(initialData?.points_per_euro ?? 10))
  const [saving, setSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const firstRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    firstRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab' || !modalRef.current) {
        return
      }

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )

      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)

    try {
      await onSubmit({
        nom: nom.trim(),
        emoji: emoji.trim() || '✨',
        prix_defaut: prix !== '' ? Number(prix) : null,
        points_defaut: pointsDefaut !== '' ? Number(pointsDefaut) : null,
        points_per_euro: Number(pointsPerEuro || 10),
      })
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div ref={modalRef} role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">{initialData ? 'Modifier service' : 'Ajouter un service'}</h3>

        <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
          <input ref={firstRef} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="Emoji" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <input type="number" step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Prix par défaut (optionnel)" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <input type="number" value={pointsDefaut} onChange={(e) => setPointsDefaut(e.target.value)} placeholder="Points par défaut (optionnel)" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <input type="number" value={pointsPerEuro} onChange={(e) => setPointsPerEuro(e.target.value)} placeholder="Points / €" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className={secondaryButtonClass}>Annuler</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900">{saving ? '...' : initialData ? 'Modifier' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
