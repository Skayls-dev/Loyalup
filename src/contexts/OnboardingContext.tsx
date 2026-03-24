import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type OnboardingStep = 1 | 2 | 3

export interface OnboardingState {
  currentStep: OnboardingStep
  account: { email: string; firstName: string } | null
  selectedNetworkIds: string[]
}

type OnboardingActions = {
  goNext: () => void
  goPrev: () => void
  setStep: (step: OnboardingStep) => void
  setAccount: (account: OnboardingState['account']) => void
  setNetworks: (networkIds: string[]) => void
  reset: () => void
}

export type OnboardingContextValue = OnboardingState & OnboardingActions

const STORAGE_KEY = 'loyalup_onboarding'

const defaultState: OnboardingState = {
  currentStep: 1,
  account: null,
  selectedNetworkIds: [],
}

function clampStep(step: number): OnboardingStep {
  if (step <= 1) return 1
  if (step >= 3) return 3
  return step as OnboardingStep
}

type StoredOnboardingState = Pick<OnboardingState, 'currentStep' | 'account' | 'selectedNetworkIds'>

function parseStoredState(raw: string | null): Partial<OnboardingState> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Partial<StoredOnboardingState>
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return {
      currentStep: Number.isFinite(Number(parsed.currentStep))
        ? clampStep(Number(parsed.currentStep))
        : undefined,
      account: parsed.account ?? null,
      selectedNetworkIds: Array.isArray(parsed.selectedNetworkIds)
        ? parsed.selectedNetworkIds.filter((id): id is string => typeof id === 'string')
        : undefined,
    }
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
      selectedNetworkIds: stored.selectedNetworkIds ?? [],
    }
  })

  useEffect(() => {
    const payload: StoredOnboardingState = {
      currentStep: state.currentStep,
      account: state.account,
      selectedNetworkIds: state.selectedNetworkIds,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [
    state.currentStep,
    state.account,
    state.selectedNetworkIds,
  ])

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ...state,
      goNext: () => setState((prev) => ({ ...prev, currentStep: clampStep(prev.currentStep + 1) })),
      goPrev: () => setState((prev) => ({ ...prev, currentStep: clampStep(prev.currentStep - 1) })),
      setStep: (step) => setState((prev) => ({ ...prev, currentStep: clampStep(step) })),
      setAccount: (account) => setState((prev) => ({ ...prev, account })),
      setNetworks: (selectedNetworkIds) => setState((prev) => ({ ...prev, selectedNetworkIds })),
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
