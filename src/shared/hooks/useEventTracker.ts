import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { eventTracker } from '../lib/eventTracker'
import type { EventType } from '../types'
import { useConsent } from './useConsent'
import { useInstallPrompt } from './useInstallPrompt'

export function useEventTracker() {
  const location = useLocation()
  const { hasConsent } = useConsent()
  const installPrompt = useInstallPrompt()

  useEffect(() => {
    eventTracker.setConsentCheck(hasConsent)
  }, [hasConsent])

  useEffect(() => {
    eventTracker.trackPageView(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    if (installPrompt.canInstall) {
      eventTracker.track('app.installed', { source: 'beforeinstallprompt' })
    }
  }, [installPrompt.canInstall])

  useEffect(() => {
    return () => {
      eventTracker.flush().catch(() => {
        // silent failure
      })
    }
  }, [])

  return useMemo(
    () => ({
      track: (eventType: EventType, properties?: Record<string, unknown>) => {
        eventTracker.track(eventType, properties)
      },
      flush: () => eventTracker.flush(),
    }),
    [],
  )
}
