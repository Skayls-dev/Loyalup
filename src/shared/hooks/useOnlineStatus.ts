import { useEffect, useRef, useState } from 'react'

type OnlineStatus = {
  isOnline: boolean
  wasOffline: boolean
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
    }

    const handleOffline = () => {
      wasOfflineRef.current = true
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) {
    const wasOffline = wasOfflineRef.current
    wasOfflineRef.current = false
    return { isOnline, wasOffline }
  }

  return { isOnline, wasOffline: false }
}
