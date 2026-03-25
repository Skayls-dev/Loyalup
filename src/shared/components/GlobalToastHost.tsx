import { useToast } from '../hooks/useToast'

export function GlobalToastHost() {
  const { toasts } = useToast()

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[140] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.slice(-3).reverse().map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur-sm transition-all ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
              : toast.type === 'error'
                ? 'border-rose-200 bg-rose-50/95 text-rose-800'
                : 'border-sky-200 bg-sky-50/95 text-sky-800'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
