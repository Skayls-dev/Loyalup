import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Router } from '../router'
import { useAuth } from '../modules/auth/hooks/useAuth'
import { useAuthStore } from '../modules/auth/store/authStore'
import { OnboardingProvider } from '../contexts/OnboardingContext'
import { ConsentModal } from '../shared/components/ConsentModal'
import { OfflineBanner } from '../shared/components/OfflineBanner'
import { InstallBanner } from '../shared/components/InstallBanner'

export function App() {
  const initialize = useAuthStore((state) => state.initialize)
  const { user } = useAuth()
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    initialize().finally(() => {
      setIsInitializing(false)
    })
  }, [initialize])

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <OfflineBanner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <OnboardingProvider>
          <Router />
        </OnboardingProvider>
      </BrowserRouter>
      {user ? <ConsentModal locale="fr" /> : null}
      <InstallBanner />
    </>
  )
}
