import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Router } from '../router'
import { useAuth } from '../modules/auth/hooks/useAuth'
import { useAuthStore } from '../modules/auth/store/authStore'
import { OnboardingProvider } from '../contexts/OnboardingContext'
import { ConsentModal } from '../shared/components/ConsentModal'
import { OfflineBanner } from '../shared/components/OfflineBanner'
import { InstallBanner } from '../shared/components/InstallBanner'
import { GlobalToastHost } from '../shared/components/GlobalToastHost'
import { supabase } from '../shared/lib/supabaseClient'
import { showToast } from '../shared/stores/toastStore'

export function App() {
  const initialize = useAuthStore((state) => state.initialize)
  const { user } = useAuth()
  const [isInitializing, setIsInitializing] = useState(true)
  const initInFlightRef = useRef<Promise<void> | null>(null)

  const safeInitialize = useCallback(async () => {
    if (initInFlightRef.current) {
      await initInFlightRef.current
      return
    }

    const run = initialize().finally(() => {
      initInFlightRef.current = null
    })

    initInFlightRef.current = run
    await run
  }, [initialize])

  useEffect(() => {
    safeInitialize().finally(() => {
      setIsInitializing(false)
    })
  }, [safeInitialize])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        return
      }

      void safeInitialize()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [safeInitialize])

  // Global reward-consumption feedback: fires regardless of which page the client is on.
  useEffect(() => {
    if (!user?.id) {
      return
    }

    const channel = supabase
      .channel(`global-client-rewards-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'client_rewards',
          filter: `client_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as {
            id?: string
            status?: string
            reward_rule_id?: string
          }

          if (row?.status !== 'used' || !row.reward_rule_id) {
            return
          }

          const { data: rule } = await supabase
            .from('reward_rules')
            .select('nom, emoji, points_required')
            .eq('id', row.reward_rule_id)
            .maybeSingle<{ nom: string | null; emoji: string | null; points_required: number | null }>()

          const emoji = rule?.emoji?.trim() || '🎁'
          const nom = rule?.nom?.trim() || 'Récompense'
          const pts = Number(rule?.points_required ?? 0)
          showToast(
            `${emoji} ${nom} consommée · -${pts} pts`,
            'success',
            3600,
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id])

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
      <GlobalToastHost />
    </>
  )
}
