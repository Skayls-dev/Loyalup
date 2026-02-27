import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Promotion, PromotionType } from '../services/promotionService'

type PromoFormValues = {
  titre: string
  description: string
  emoji: string
  type: PromotionType
  valeur: string
  date_debut: string
  date_fin: string
}

type PromoFormSubmit = {
  titre: string
  description: string
  emoji: string
  type: PromotionType
  valeur: number | null
  date_debut: string
  date_fin: string
}

type PromoFormProps = {
  initialData?: Promotion | null
  onSubmit: (data: PromoFormSubmit) => Promise<void>
  onCancel: () => void
}

const secondaryButtonClass =
  'rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60'

const emojiOptions = ['🔥', '🎉', '☕', '🍔', '🥐', '🍕', '🍩', '🎁', '✨', '💎', '📣', '🛍️', '🍹', '🥤', '🍫', '🍓', '🌟', '🎯', '🏷️', '💥']

export function PromoForm({ initialData, onSubmit, onCancel }: PromoFormProps) {
  const [values, setValues] = useState<PromoFormValues>(() => ({
    titre: initialData?.titre ?? '',
    description: initialData?.description ?? '',
    emoji: initialData?.emoji ?? '🔥',
    type: initialData?.type ?? 'custom',
    valeur: initialData?.valeur !== null && initialData?.valeur !== undefined ? String(initialData.valeur) : '',
    date_debut: initialData?.date_debut ? initialData.date_debut.slice(0, 16) : '',
    date_fin: initialData?.date_fin ? initialData.date_fin.slice(0, 16) : '',
  }))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    firstInputRef.current?.focus()

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
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onCancel])

  const submitLabel = useMemo(() => (initialData ? 'Modifier' : 'Créer la promotion'), [initialData])

  const showValeur = values.type === 'discount' || values.type === 'double_points'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!values.titre.trim()) {
      setError('Le titre est obligatoire.')
      return
    }

    const start = new Date(values.date_debut)
    const end = new Date(values.date_fin)

    if (!(start.getTime() < end.getTime())) {
      setError('date_fin doit être strictement après date_debut.')
      return
    }

    setSaving(true)

    try {
      await onSubmit({
        titre: values.titre.trim(),
        description: values.description.trim(),
        emoji: values.emoji,
        type: values.type,
        valeur: showValeur && values.valeur !== '' ? Number(values.valeur) : null,
        date_debut: start.toISOString(),
        date_fin: end.toISOString(),
      })
      onCancel()
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to save promotion'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-100"
      >
        <h3 className="text-lg font-semibold">{initialData ? 'Modifier la promotion' : 'Nouvelle promotion'}</h3>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <input
            ref={firstInputRef}
            type="text"
            placeholder="Titre"
            value={values.titre}
            onChange={(event) => setValues((prev) => ({ ...prev, titre: event.target.value }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />

          <textarea
            placeholder="Description"
            value={values.description}
            onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
            className="min-h-20 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-5 gap-2">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, emoji }))}
                className={`rounded-lg border px-2 py-2 text-xl ${
                  values.emoji === emoji ? 'border-zinc-100 bg-zinc-800' : 'border-zinc-700 bg-zinc-950'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(['double_points', 'discount', 'free_item', 'custom'] as PromotionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, type }))}
                className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                  values.type === type ? 'border-zinc-100 bg-zinc-800' : 'border-zinc-700 bg-zinc-950'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {showValeur ? (
            <input
              type="number"
              step="0.01"
              placeholder="Valeur"
              value={values.valeur}
              onChange={(event) => setValues((prev) => ({ ...prev, valeur: event.target.value }))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          ) : null}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              type="datetime-local"
              value={values.date_debut}
              onChange={(event) => setValues((prev) => ({ ...prev, date_debut: event.target.value }))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={values.date_fin}
              onChange={(event) => setValues((prev) => ({ ...prev, date_fin: event.target.value }))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>

          {error ? <p className="text-xs text-red-300">{error}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className={secondaryButtonClass}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
            >
              {saving ? '...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
