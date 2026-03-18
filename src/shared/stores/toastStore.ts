export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

type Listener = (items: ToastItem[]) => void

let currentItems: ToastItem[] = []
const subscribers = new Set<Listener>()

function broadcast(): void {
  subscribers.forEach((fn) => fn(currentItems))
}

export function showToast(message: string, type: ToastType = 'success', duration = 2500): void {
  const id = Math.random().toString(36).slice(2)
  currentItems = [...currentItems, { id, message, type }]
  broadcast()
  window.setTimeout(() => {
    currentItems = currentItems.filter((t) => t.id !== id)
    broadcast()
  }, duration)
}

export function subscribeToToasts(listener: Listener): () => void {
  subscribers.add(listener)
  listener(currentItems)
  return () => {
    subscribers.delete(listener)
  }
}
