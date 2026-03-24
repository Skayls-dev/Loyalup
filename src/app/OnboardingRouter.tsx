import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import Step1Join from '../pages/onboarding/Step1Join'
import Step2Network from '../pages/onboarding/Step2Network'
import Step3Launch from '../pages/onboarding/Step3Launch'
import { OnboardingLayout } from '../layouts/OnboardingLayout'
import { type OnboardingStep, useOnboarding } from '../contexts/OnboardingContext'
import { supabase } from '../shared/lib/supabaseClient'

const STORAGE_KEY = 'loyalup_onboarding'

type StoredSnapshot = {
  currentStep?: number
  account?: { email: string; firstName: string } | null
  selectedNetworkIds?: string[]
}

function toStep(step: number): OnboardingStep {
  if (step <= 1) return 1
  if (step >= 3) return 3
  return step as OnboardingStep
}

function readStoredSnapshot(): StoredSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredSnapshot
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function inferStepFromData(args: { accountEmail: string; networkIds: string[] }): OnboardingStep {
  if (args.networkIds.length > 0) return 3
  if (args.accountEmail) return 2
  return 1
}

function StepScreen({ step, children }: { step: OnboardingStep; children: ReactNode }) {
  return <OnboardingLayout currentStep={step}>{children}</OnboardingLayout>
}

export default function OnboardingRouter() {
  const navigate = useNavigate()
  const location = useLocation()

  const {
    currentStep,
    setStep,
    setAccount,
    setNetworks,
    selectedNetworkIds,
    account,
  } = useOnboarding()

  const [hydrated, setHydrated] = useState(false)

  const pathStep = useMemo(() => {
    const match = location.pathname.match(/^\/onboarding\/(\d)$/)
    if (!match) return null
    const n = Number(match[1])
    if (!Number.isFinite(n) || n < 1 || n > 3) return null
    return toStep(n)
  }, [location.pathname])

  const maxAllowedStep = useMemo(
    () =>
      inferStepFromData({
        accountEmail: account?.email ?? '',
        networkIds: selectedNetworkIds,
      }),
    [account?.email, selectedNetworkIds],
  )

  useEffect(() => {
    let cancelled = false

    async function hydrateResumeState() {
      const stored = readStoredSnapshot()

      if (stored.account) {
        setAccount(stored.account)
      }

      if (Array.isArray(stored.selectedNetworkIds)) {
        setNetworks(stored.selectedNetworkIds)
      }

      const { data: authData } = await supabase.auth.getUser()
      if (cancelled) return

      const user = authData.user
      let accountEmail = stored.account?.email ?? user?.email ?? ''
      let mergedNetworkIds = stored.selectedNetworkIds ?? []

      if (user) {
        const metadata = user.user_metadata as Record<string, unknown> | undefined
        const onboardingCompleted =
          metadata?.onboarding_completed === true || metadata?.onboarding_complete === true

        if (onboardingCompleted) {
          navigate('/dashboard', { replace: true })
          return
        }

        const candidateAccount = {
          email: user.email ?? '',
          firstName: String(user.user_metadata?.first_name ?? user.user_metadata?.given_name ?? ''),
        }

        if (candidateAccount.email) {
          setAccount(candidateAccount)
          accountEmail = candidateAccount.email
        }

        const networksResponse = await supabase
          .from('network_clients')
          .select('network_id')
          .eq('client_id', user.id)

        if (cancelled) return

        if (!networksResponse.error && Array.isArray(networksResponse.data)) {
          const ids = networksResponse.data
            .map((row) => String((row as { network_id?: unknown }).network_id ?? ''))
            .filter(Boolean)

          mergedNetworkIds = ids.length > 0 ? ids : mergedNetworkIds

          if (ids.length > 0) {
            setNetworks(ids)
          }
        }
      }

      const resumedStep = inferStepFromData({
        accountEmail,
        networkIds: mergedNetworkIds,
      })

      const requestedStep = pathStep ?? resumedStep
      const finalStep = requestedStep > resumedStep ? resumedStep : requestedStep
      setStep(finalStep)
      setHydrated(true)
    }

    hydrateResumeState().catch(() => setHydrated(true))

    return () => {
      cancelled = true
    }
  }, [navigate, pathStep])

  useEffect(() => {
    if (!hydrated) return
    if (!pathStep) return
    const nextStep = pathStep > maxAllowedStep ? maxAllowedStep : pathStep
    if (nextStep !== currentStep) {
      setStep(nextStep)
    }
  }, [currentStep, hydrated, maxAllowedStep, pathStep, setStep])

  useEffect(() => {
    if (!hydrated) return
    const expectedPath = `/onboarding/${currentStep}`
    if (location.pathname !== expectedPath) {
      navigate(expectedPath, { replace: true })
    }
  }, [currentStep, hydrated, location.pathname, navigate])

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="1" element={<StepScreen step={1}><Step1Join /></StepScreen>} />
      <Route path="2" element={<StepScreen step={2}><Step2Network /></StepScreen>} />
      <Route path="3" element={<StepScreen step={3}><Step3Launch /></StepScreen>} />
      <Route path="*" element={<Navigate to={`/onboarding/${currentStep}`} replace />} />
    </Routes>
  )
}
