import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'points' | 'challenge' | 'tier' | 'badge' | 'streak'

export type ToastItem = {
  type: ToastType
  title: string
  subtitle: string
  points?: number
  color?: string
}

type InternalToast = ToastItem & {
  id: string
  createdAt: number
}

type ToastContextValue = {
  showToast: (item: ToastItem) => void
  dismissAll: () => void
}

const TOAST_LIFETIME_MS = 4000
const MAX_QUEUE = 5
const MAX_VISIBLE = 3

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_STYLE_MAP: Record<
  ToastType,
  {
    icon: string
    background: string
    accent: string
    valueClassName: string
    valuePrefix: string
  }
> = {
  points: {
    icon: '✦',
    background: '#EBE9FF',
    accent: '#5B4FE8',
    valueClassName: 'text-emerald-700',
    valuePrefix: '+',
  },
  challenge: {
    icon: '◎',
    background: '#E1F5EE',
    accent: '#059669',
    valueClassName: 'text-emerald-700',
    valuePrefix: '+',
  },
  tier: {
    icon: '⭐',
    background: '#FAEEDA',
    accent: '#B8860B',
    valueClassName: 'text-amber-700',
    valuePrefix: '',
  },
  badge: {
    icon: '🏅',
    background: '#FBEAF0',
    accent: '#BE185D',
    valueClassName: 'text-pink-700',
    valuePrefix: '',
  },
  streak: {
    icon: '🔥',
    background: '#FFF3EE',
    accent: '#EA580C',
    valueClassName: 'text-orange-700',
    valuePrefix: '+',
  },
}

function getStackTransform(index: number): string {
  if (index === 1) return 'translateY(8px) scale(0.97)'
  if (index === 2) return 'translateY(16px) scale(0.93)'
  return 'translateY(0px) scale(1)'
}

function getStackOpacity(index: number): number {
  if (index === 1) return 0.85
  if (index === 2) return 0.6
  return 1
}

function ToastCard({
  toast,
  index,
  onDismiss,
}: {
  toast: InternalToast
  index: number
  onDismiss: (id: string) => void
}) {
  const swipeRef = useRef<{ startX: number; startY: number; active: boolean }>({
    startX: 0,
    startY: 0,
    active: false,
  })

  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const style = TOAST_STYLE_MAP[toast.type]
  const value = typeof toast.points === 'number' ? `${style.valuePrefix}${toast.points}` : null

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(min-width: 768px)').matches) return

    swipeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      active: true,
    }
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeRef.current.active) return

    const deltaX = event.clientX - swipeRef.current.startX
    const deltaY = event.clientY - swipeRef.current.startY

    if (Math.abs(deltaY) > 28) {
      swipeRef.current.active = false
      setDragging(false)
      setDragX(0)
      return
    }

    if (deltaX > 0) {
      setDragX(deltaX)
    }
  }

  const endSwipe = () => {
    if (!swipeRef.current.active) {
      setDragging(false)
      setDragX(0)
      return
    }

    if (dragX > 72) {
      onDismiss(toast.id)
    }

    swipeRef.current.active = false
    setDragging(false)
    setDragX(0)
  }

  return (
    <div
      className="pointer-events-auto absolute right-0 top-0 w-[min(92vw,360px)] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur"
      style={{
        transform: `${getStackTransform(index)} translateX(${dragX}px)`,
        opacity: getStackOpacity(index),
        zIndex: MAX_VISIBLE - index,
        transition: dragging
          ? 'transform 60ms linear, opacity 180ms ease'
          : 'transform 420ms cubic-bezier(.34,1.2,.64,1), opacity 240ms ease',
        animation: 'toast-enter 420ms cubic-bezier(.34,1.2,.64,1)',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
          style={{
            backgroundColor: toast.color ?? style.background,
            color: style.accent,
          }}
          aria-hidden="true"
        >
          {style.icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{toast.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-600">{toast.subtitle}</p>
        </div>

        <div className="ml-2 flex items-start gap-2">
          {value ? <span className={`text-sm font-semibold ${style.valueClassName}`}>{value}</span> : null}
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer le toast"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200/80">
        <div className="h-full rounded-full bg-slate-500/70 toast-progress" />
      </div>
    </div>
  )
}

function ToastPortal({
  toasts,
  dismiss,
}: {
  toasts: InternalToast[]
  dismiss: (id: string) => void
}) {
  const target = typeof document !== 'undefined' ? document.getElementById('toast-root') : null

  if (!target) {
    return null
  }

  const visible = toasts.slice(0, MAX_VISIBLE)

  return createPortal(
    <>
      <style>
        {`@keyframes toast-enter {
            from { transform: translateX(120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes toast-progress-shrink {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
          .toast-progress {
            transform-origin: left center;
            animation: toast-progress-shrink ${TOAST_LIFETIME_MS}ms linear forwards;
          }`}
      </style>

      <div className="pointer-events-none fixed right-4 top-4 z-[140]">
        <div className="relative h-[210px] w-[min(92vw,360px)]">
          {visible.map((toast, index) => (
            <ToastCard key={toast.id} toast={toast} index={index} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </>,
    target,
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<InternalToast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((item: ToastItem) => {
    setToasts((prev) => {
      const next: InternalToast[] = [
        {
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: Date.now(),
        },
        ...prev,
      ]

      return next.slice(0, MAX_QUEUE)
    })
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  useEffect(() => {
    if (!toasts.length) return

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismiss(toast.id)
      }, TOAST_LIFETIME_MS),
    )

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId))
    }
  }, [dismiss, toasts])

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissAll,
    }),
    [dismissAll, showToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastPortal toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider')
  }

  return context
}
