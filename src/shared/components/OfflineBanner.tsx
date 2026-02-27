import { useEffect, useState } from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus()
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    if (wasOffline && isOnline) {
      setShowReconnected(true)
      const timeout = window.setTimeout(() => setShowReconnected(false), 1800)
      return () => window.clearTimeout(timeout)
    }

    return undefined
  }, [isOnline, wasOffline])

  if (!isOnline) {
    return (
      <div className="fixed left-0 right-0 top-0 z-[60] animate-[slideDown_220ms_ease-out] bg-amber-500/95 px-4 py-2 text-center text-sm font-medium text-zinc-950">
        Mode hors ligne · Certaines fonctions indisponibles
      </div>
    )
  }

  if (showReconnected) {
    return (
      <div className="fixed left-0 right-0 top-0 z-[60] animate-[slideDown_220ms_ease-out] bg-emerald-500/95 px-4 py-2 text-center text-sm font-medium text-zinc-950">
        Reconnecté ✓
      </div>
    )
  }

  return null
}
