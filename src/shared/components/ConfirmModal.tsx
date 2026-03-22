import { useEffect, useState } from 'react'

type ConfirmModalProps = {
  open: boolean
  title: string
  description: string
  onClose: () => void
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  destructive?: boolean
  theme?: 'light' | 'dark'
}

const ANIMATION_MS = 180

export function ConfirmModal({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  loading = false,
  destructive = false,
  theme = 'light',
}: ConfirmModalProps) {
  const [isMounted, setIsMounted] = useState(open)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setIsMounted(true)
      requestAnimationFrame(() => setIsVisible(true))
      return
    }

    setIsVisible(false)
    const timeoutId = window.setTimeout(() => {
      setIsMounted(false)
    }, ANIMATION_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [open])

  useEffect(() => {
    if (!isMounted) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMounted, loading, onClose])

  if (!isMounted) {
    return null
  }

  const isDark = theme === 'dark'
  const overlayClass = isDark ? 'bg-zinc-950/80' : 'bg-slate-900/20 backdrop-blur-sm'
  const panelClass = isDark
    ? 'border-zinc-800 bg-zinc-900 text-zinc-100'
    : 'border-white/70 bg-white/95 text-slate-900 shadow-xl shadow-slate-900/10 backdrop-blur-xl'
  const eyebrowClass = isDark ? 'text-zinc-500' : 'text-slate-500'
  const descriptionClass = isDark ? 'text-zinc-300' : 'text-slate-600'
  const cancelClass = isDark
    ? 'border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
  const confirmClass = destructive
    ? isDark
      ? 'border-red-800/80 bg-red-700 text-white hover:bg-red-600'
      : 'border-red-200 bg-red-600 text-white hover:bg-red-500'
    : isDark
      ? 'border-zinc-700 bg-zinc-100 text-zinc-900 hover:bg-white'
      : 'border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-500'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${overlayClass} ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full max-w-md rounded-2xl border p-5 transition-all duration-200 ${panelClass} ${isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.98] opacity-0'}`}
        onMouseDown={(event) => {
          event.stopPropagation()
        }}
      >
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${eyebrowClass}`}>
          Confirmation
        </p>
        <h3 className="mt-1 text-lg font-semibold">{title}</h3>
        <p className={`mt-2 text-sm ${descriptionClass}`}>{description}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${cancelClass}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? 'Traitement...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}