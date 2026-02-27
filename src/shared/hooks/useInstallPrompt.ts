import { useCallback, useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type UseInstallPromptResult = {
  canInstall: boolean
  promptInstall: () => Promise<boolean>
  isInstalled: boolean
}

export function useInstallPrompt(): UseInstallPromptResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches
    const navigatorStandalone = 'standalone' in navigator ? Boolean((navigator as Navigator & { standalone?: boolean }).standalone) : false

    if (displayModeStandalone || navigatorStandalone) {
      setIsInstalled(true)
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const onInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return false
    }

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
      setDeferredPrompt(null)
      return true
    }

    return false
  }, [deferredPrompt])

  return useMemo(
    () => ({
      canInstall: Boolean(deferredPrompt) && !isInstalled,
      promptInstall,
      isInstalled,
    }),
    [deferredPrompt, isInstalled, promptInstall],
  )
}
