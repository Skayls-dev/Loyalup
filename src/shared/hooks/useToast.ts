import { useEffect, useState } from 'react'
import { showToast, subscribeToToasts } from '../stores/toastStore'
import type { ToastItem, ToastType } from '../stores/toastStore'

export type { ToastItem, ToastType }

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => subscribeToToasts(setToasts), [])

  return { toasts, show: showToast }
}
