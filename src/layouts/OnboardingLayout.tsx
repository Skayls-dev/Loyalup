import type { ReactNode } from 'react'

type OnboardingLayoutProps = {
  currentStep: number
  children: ReactNode
}

const TOTAL_STEPS = 3

function clampStep(step: number): number {
  return Math.min(TOTAL_STEPS, Math.max(1, step))
}

function StepNode({ step, activeStep }: { step: number; activeStep: number }) {
  const done = step < activeStep
  const active = step === activeStep

  const style: React.CSSProperties = active
    ? {
        backgroundColor: '#5B4FE8',
        color: '#FFFFFF',
        borderColor: '#5B4FE8',
        boxShadow: '0 0 0 4px #EBE9FF',
      }
    : done
      ? {
          backgroundColor: '#5B4FE8',
          color: '#FFFFFF',
          borderColor: '#5B4FE8',
        }
      : {
          backgroundColor: '#FFFFFF',
          color: '#6B7280',
          borderColor: '#D1D5DB',
        }

  return (
    <div
      className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300"
      style={style}
      aria-current={active ? 'step' : undefined}
      aria-label={`Étape ${step}`}
    >
      {done ? '✓' : String(step)}
    </div>
  )
}

function StepLine({ done }: { done: boolean }) {
  return (
    <div
      className="h-[2px] flex-1 transition-all duration-300"
      style={{ backgroundColor: done ? '#5B4FE8' : '#D1D5DB' }}
      aria-hidden="true"
    />
  )
}

function ProgressDot({ index, activeStep }: { index: number; activeStep: number }) {
  const done = index < activeStep
  const active = index === activeStep

  if (active) {
    return (
      <span
        className="h-2 rounded-full transition-all duration-300"
        style={{ width: 18, backgroundColor: '#5B4FE8' }}
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className="h-2 w-2 rounded-full transition-all duration-300"
      style={{ backgroundColor: done ? '#BDB4FF' : '#D1D5DB' }}
      aria-hidden="true"
    />
  )
}

export function OnboardingLayout({ currentStep, children }: OnboardingLayoutProps) {
  const activeStep = clampStep(currentStep)

  return (
    <section
      className="min-h-screen w-full px-4 py-8"
      style={{ background: 'linear-gradient(135deg, #F4F5F8, #EBE9FF)' }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col items-center justify-center">
        <div className="mb-6 text-center">
          <p className="font-display text-4xl font-extrabold text-dark">Looyaal</p>
        </div>

        <div className="mb-8 flex w-full max-w-2xl items-center">
          {[1, 2, 3].map((step, idx) => (
            <div key={step} className="flex w-full items-center">
              <StepNode step={step} activeStep={activeStep} />
              {idx < TOTAL_STEPS - 1 ? <StepLine done={activeStep > step} /> : null}
            </div>
          ))}
        </div>

        <article
          className="w-full max-w-[920px] rounded-[24px] border border-white/70 bg-white p-6 md:p-8"
          style={{ boxShadow: '0 18px 45px -28px rgba(91,79,232,0.30)' }}
        >
          <div>{children}</div>

          <div className="mt-8 flex items-center justify-center gap-2" aria-label="Progression onboarding">
            {[1, 2, 3].map((step) => (
              <ProgressDot key={step} index={step} activeStep={activeStep} />
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

export default OnboardingLayout
