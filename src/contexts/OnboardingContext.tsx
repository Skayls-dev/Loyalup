import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type OnboardingStep = 1 | 2 | 3 | 4 | 5

export interface OnboardingState {
  currentStep: OnboardingStep
  account: { email: string; firstName: string; lastName: string } | null
  profile: { avatarId: string; city: string; country: string; language: string } | null
  selectedNetworkIds: string[]
  selectedInterests: string[]
  isSubmitting: boolean
  error: string | null
}

type OnboardingActions = {
  goNext: () => void
  goPrev: () => void
  setStep: (step: OnboardingStep) => void
  setAccount: (account: OnboardingState['account']) => void
  setProfile: (profile: OnboardingState['profile']) => void
  setNetworks: (networkIds: string[]) => void
  setInterests: (interestIds: string[]) => void
  setSubmitting: (submitting: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export type OnboardingContextValue = OnboardingState & OnboardingActions

const STORAGE_KEY = 'loyalup_onboarding'

const defaultState: OnboardingState = {
  currentStep: 1,
  account: null,
  profile: null,
  selectedNetworkIds: [],
  selectedInterests: [],
  isSubmitting: false,
  error: null,
}

function clampStep(step: number): OnboardingStep {
  if (step <= 1) return 1
  if (step >= 5) return 5
  return step as OnboardingStep
}

function parseStoredState(raw: string | null): Partial<OnboardingState> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(() => {
    const stored = parseStoredState(localStorage.getItem(STORAGE_KEY))
    return {
      currentStep: clampStep(Number(stored.currentStep ?? 1)),
      account: stored.account ?? null,
      profile: stored.profile ?? null,
      selectedNetworkIds: stored.selectedNetworkIds ?? [],
      selectedInterests: stored.selectedInterests ?? [],
      isSubmitting: false,
      error: null,
    }
  })

  useEffect(() => {
    const payload: OnboardingState = {
      currentStep: state.currentStep,
      account: state.account,
      profile: state.profile,
      selectedNetworkIds: state.selectedNetworkIds,
      selectedInterests: state.selectedInterests,
      isSubmitting: false,
      error: null,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [
    state.currentStep,
    state.account,
    state.profile,
    state.selectedNetworkIds,
    state.selectedInterests,
  ])

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ...state,
      goNext: () => setState((prev) => ({ ...prev, currentStep: clampStep(prev.currentStep + 1), error: null })),
      goPrev: () => setState((prev) => ({ ...prev, currentStep: clampStep(prev.currentStep - 1), error: null })),
      setStep: (step) => setState((prev) => ({ ...prev, currentStep: clampStep(step), error: null })),
      setAccount: (account) => setState((prev) => ({ ...prev, account })),
      setProfile: (profile) => setState((prev) => ({ ...prev, profile })),
      setNetworks: (selectedNetworkIds) => setState((prev) => ({ ...prev, selectedNetworkIds })),
      setInterests: (selectedInterests) => setState((prev) => ({ ...prev, selectedInterests })),
      setSubmitting: (isSubmitting) => setState((prev) => ({ ...prev, isSubmitting })),
      setError: (error) => setState((prev) => ({ ...prev, error })),
      reset: () => {
        localStorage.removeItem(STORAGE_KEY)
        setState(defaultState)
      },
    }),
    [state],
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used inside OnboardingProvider')
  }
  return context
}
