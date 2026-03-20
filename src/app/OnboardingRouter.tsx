import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useBlocker,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import Step1Account from '../pages/onboarding/Step1Account'
import Step2Profile from '../pages/onboarding/Step2Profile'
import Step3Networks from '../pages/onboarding/Step3Networks'
import Step4Interests from '../pages/onboarding/Step4Interests'
import Step5Success from '../pages/onboarding/Step5Success'
import { OnboardingLayout } from '../layouts/OnboardingLayout'
import { type OnboardingStep, useOnboarding } from '../contexts/OnboardingContext'
import { supabase } from '../shared/lib/supabaseClient'

const STORAGE_KEY = 'loyalup_onboarding'

type StoredSnapshot = {
  currentStep?: number
  account?: { email: string; firstName: string; lastName: string } | null
  profile?: { avatarId: string; city: string; country: string; language: string } | null
  selectedNetworkIds?: string[]
  selectedInterests?: string[]
}

function toStep(step: number): OnboardingStep {
  if (step <= 1) return 1
  if (step >= 5) return 5
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

function inferStepFromData(args: {
  accountEmail: string
  profile: { avatarId: string; city: string; country: string; language: string } | null
  networkIds: string[]
  interests: string[]
}): OnboardingStep {
  const hasAccount = Boolean(args.accountEmail)
  const hasProfile = Boolean(
    args.profile &&
      (args.profile.avatarId || args.profile.city || args.profile.country || args.profile.language),
  )

  if (args.interests.length > 0) return 5
  if (args.networkIds.length > 0) return 4
  if (hasProfile) return 3
  if (hasAccount) return 2
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
    goPrev,
    setAccount,
    setProfile,
    setNetworks,
    setInterests,
    selectedNetworkIds,
    selectedInterests,
    profile,
    account,
  } = useOnboarding()

  const [hydrated, setHydrated] = useState(false)

  const pathStep = useMemo(() => {
    const match = location.pathname.match(/^\/onboarding\/(\d)$/)
    if (!match) return null
    const n = Number(match[1])
    if (!Number.isFinite(n) || n < 1 || n > 5) return null
    return toStep(n)
  }, [location.pathname])

  const maxAllowedStep = useMemo(
    () =>
      inferStepFromData({
        accountEmail: account?.email ?? '',
        profile,
        networkIds: selectedNetworkIds,
        interests: selectedInterests,
      }),
    [account?.email, profile, selectedInterests, selectedNetworkIds],
  )

  useEffect(() => {
    let cancelled = false

    async function hydrateResumeState() {
      const stored = readStoredSnapshot()
      if (stored.account) {
        setAccount(stored.account)
      }
      if (stored.profile) {
        setProfile(stored.profile)
      }
      if (Array.isArray(stored.selectedNetworkIds)) {
        setNetworks(stored.selectedNetworkIds)
      }
      if (Array.isArray(stored.selectedInterests)) {
        setInterests(stored.selectedInterests)
      }

      const { data: authData } = await supabase.auth.getUser()
      if (cancelled) return

      const user = authData.user
      let accountEmail = stored.account?.email ?? user?.email ?? ''
      let mergedProfile = stored.profile ?? null
      let mergedNetworkIds = stored.selectedNetworkIds ?? []
      let mergedInterests = stored.selectedInterests ?? []

      if (user) {
        const candidateAccount = {
          email: user.email ?? '',
          firstName: String(user.user_metadata?.first_name ?? user.user_metadata?.given_name ?? ''),
          lastName: String(user.user_metadata?.last_name ?? user.user_metadata?.family_name ?? ''),
        }

        if (candidateAccount.email) {
          setAccount(candidateAccount)
          accountEmail = candidateAccount.email
        }

        const metadata = user.user_metadata as Record<string, unknown> | undefined
        const onboardingCompleted =
          metadata?.onboarding_completed === true || metadata?.onboarding_complete === true

        if (onboardingCompleted) {
          navigate('/dashboard', { replace: true })
          return
        }

        const mappedProfile = {
          avatarId: typeof metadata?.avatar_id === 'string' ? metadata.avatar_id : 'lion',
          city: typeof metadata?.city === 'string' ? metadata.city : '',
          country: typeof metadata?.country === 'string' ? metadata.country : 'Belgique',
          language: typeof metadata?.language === 'string' ? metadata.language : 'Français',
        }

        if (
          mappedProfile.avatarId ||
          mappedProfile.city ||
          mappedProfile.country !== 'Belgique' ||
          mappedProfile.language !== 'Français'
        ) {
          mergedProfile = mappedProfile
          setProfile(mappedProfile)
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

        const interestsResponse = await supabase
          .from('user_interests')
          .select('interest_slug')
          .eq('user_id', user.id)

        if (cancelled) return

        if (!interestsResponse.error && Array.isArray(interestsResponse.data)) {
          const slugs = interestsResponse.data
            .map((row) => String((row as { interest_slug?: unknown }).interest_slug ?? ''))
            .filter(Boolean)
          mergedInterests = slugs.length > 0 ? slugs : mergedInterests
          if (slugs.length > 0) {
            setInterests(slugs)
          }
        }
      }

      const resumedStep = inferStepFromData({
        accountEmail,
        profile: mergedProfile,
        networkIds: mergedNetworkIds,
        interests: mergedInterests,
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
  }, [navigate, pathStep, setAccount, setInterests, setNetworks, setProfile, setStep])

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

  const blocker = useBlocker(
    ({
      historyAction,
      currentLocation,
      nextLocation,
    }: {
      historyAction: string
      currentLocation: { pathname: string }
      nextLocation: { pathname: string }
    }) =>
      historyAction === 'POP' &&
      currentLocation.pathname.startsWith('/onboarding/') &&
      nextLocation.pathname.startsWith('/onboarding/') &&
      currentStep > 1,
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    goPrev()
    blocker.reset()
  }, [blocker, goPrev])

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="1" element={<StepScreen step={1}><Step1Account /></StepScreen>} />
      <Route path="2" element={<StepScreen step={2}><Step2Profile /></StepScreen>} />
      <Route path="3" element={<StepScreen step={3}><Step3Networks /></StepScreen>} />
      <Route path="4" element={<StepScreen step={4}><Step4Interests /></StepScreen>} />
      <Route path="5" element={<StepScreen step={5}><Step5Success /></StepScreen>} />
      <Route path="*" element={<Navigate to={`/onboarding/${currentStep}`} replace />} />
    </Routes>
  )
}
