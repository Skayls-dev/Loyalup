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
          <div className="space-y-1">
            <label htmlFor="service-nom" className="text-xs font-medium text-zinc-300">Nom du service</label>
            <input id="service-nom" ref={firstRef} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Soin Premium" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label htmlFor="service-emoji" className="text-xs font-medium text-zinc-300">Emoji</label>
            <input id="service-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="Ex: ✨" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label htmlFor="service-prix" className="text-xs font-medium text-zinc-300">Prix par défaut (€) <span className="text-zinc-500">(optionnel)</span></label>
            <input id="service-prix" type="number" step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Ex: 29" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label htmlFor="service-points-defaut" className="text-xs font-medium text-zinc-300">Points fixes accordés <span className="text-zinc-500">(optionnel)</span></label>
            <input id="service-points-defaut" type="number" value={pointsDefaut} onChange={(e) => setPointsDefaut(e.target.value)} placeholder="Ex: 55" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          </div>

          <div className="space-y-1">
            <label htmlFor="service-points-per-euro" className="text-xs font-medium text-zinc-300">Points par euro (€)</label>
            <input id="service-points-per-euro" type="number" value={pointsPerEuro} onChange={(e) => setPointsPerEuro(e.target.value)} placeholder="Ex: 8" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <p className="text-[11px] text-zinc-500">Utilisé quand "Points fixes accordés" est vide.</p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className={secondaryButtonClass}>Annuler</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900">{saving ? '...' : initialData ? 'Modifier' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
