import { useEffect, useMemo, useState } from 'react'
import { CONSENT_TYPE_LIST, CONSENT_TYPES, CURRENT_POLICY_VERSION, type SupportedLocale } from '../lib/consentPolicy'
import { useConsent } from '../hooks/useConsent'
import type { ConsentType } from '../types'

type ConsentModalProps = {
  locale?: SupportedLocale
}

const PRIVACY_POLICY_URL = {
  fr: '/privacy/fr',
  en: '/privacy/en',
  ar: '/privacy/ar',
  es: '/privacy/es',
  nl: '/privacy/nl',
}

const CONSENT_STORAGE_KEY = `loyalup-consent-v${CURRENT_POLICY_VERSION}`

function getStoredChoices(): Record<ConsentType, boolean> | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as { choices?: Partial<Record<ConsentType, boolean>> }
    return {
      essential: true,
      analytics: Boolean(parsed.choices?.analytics),
      marketing: Boolean(parsed.choices?.marketing),
      third_party: Boolean(parsed.choices?.third_party),
    }
  } catch {
    return null
  }
}

function markChoicesStored(choices: Record<ConsentType, boolean>) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        policyVersion: CURRENT_POLICY_VERSION,
        updatedAt: new Date().toISOString(),
        choices,
      }),
    )
  } catch {
    null
  }
}

export function ConsentModal({ locale = 'fr' }: ConsentModalProps) {
  const { consents, updateConsent, loading } = useConsent()
  const [expanded, setExpanded] = useState(false)
  const [choices, setChoices] = useState<Record<ConsentType, boolean>>(
    () =>
      getStoredChoices() ?? {
        essential: true,
        analytics: false,
        marketing: false,
        third_party: false,
      },
  )
  const [submitting, setSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  const hasFullConsentForCurrentPolicy = useMemo(() => {
    const consentTypes = new Set(
      consents
        .filter((consent) => consent.policy_version === CURRENT_POLICY_VERSION)
        .map((consent) => consent.consent_type),
    )

    return CONSENT_TYPE_LIST.every((type) => consentTypes.has(type))
  }, [consents])

  const hasStoredConsentSnapshot = useMemo(() => Boolean(getStoredChoices()), [consents])

  const initialChoices = useMemo(() => {
    const stored = getStoredChoices()
    const next: Record<ConsentType, boolean> = {
      essential: true,
      analytics: stored?.analytics ?? false,
      marketing: stored?.marketing ?? false,
      third_party: stored?.third_party ?? false,
    }

    for (const row of consents) {
      if (row.policy_version !== CURRENT_POLICY_VERSION) {
        continue
      }
      next[row.consent_type] = row.granted && !row.revoked_at
    }

    return next
  }, [consents])

  useEffect(() => {
    setChoices(initialChoices)
  }, [initialChoices])

  if (hasFullConsentForCurrentPolicy || hasStoredConsentSnapshot || isCompleted) {
    return null
  }

  const handleToggle = (type: ConsentType) => {
    if (type === 'essential') {
      return
    }

    setChoices((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))
  }

  const saveChoices = async (allAccepted = false) => {
    setSubmitting(true)

    const nextChoices: Record<ConsentType, boolean> = {
      essential: true,
      analytics: allAccepted ? true : choices.analytics,
      marketing: allAccepted ? true : choices.marketing,
      third_party: allAccepted ? true : choices.third_party,
    }

    try {
      for (const type of CONSENT_TYPE_LIST) {
        const granted = nextChoices[type]
        await updateConsent(type, granted)
      }
    } catch {
      // Keep UX resilient: local persistence still allows user to proceed.
    } finally {
      markChoicesStored(nextChoices)
      setIsCompleted(true)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0b0715] text-white">
      {/* Ambient blobs — mirrors the auth brand panel */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-violet-700/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-700/10 blur-2xl" />
      {/* Dot-grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 py-8">
        {/* Wordmark */}
        <div className="mb-8 flex items-center gap-2">
          <span className="text-3xl font-black tracking-tight text-white">Looyaal</span>
          <span className="h-2.5 w-2.5 rounded-full bg-violet-400" aria-hidden="true" />
        </div>

        {/* Card */}
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/50">
          {/* Card header */}
          <div className="px-6 pb-4 pt-6">
            <h2 className="text-xl font-bold text-zinc-900">Avant de commencer</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choisissez vos préférences de confidentialité.
            </p>
          </div>

          {/* Consent items */}
          <div className="space-y-2 px-6">
            {CONSENT_TYPE_LIST.map((type) => {
              const item = CONSENT_TYPES[type]
              const visible = expanded || type === 'essential'

              if (!visible) {
                return null
              }

              const granted = choices[type]

              return (
                <div
                  key={type}
                  className={`flex items-start gap-4 rounded-xl border p-4 transition ${
                    granted
                      ? 'border-violet-200 bg-violet-50/60'
                      : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{item.title[locale]}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{item.description[locale]}</p>
                  </div>
                  {/* Toggle switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={granted}
                    onClick={() => handleToggle(type)}
                    disabled={item.required || submitting || loading}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 ${
                      granted ? 'bg-gradient-to-r from-violet-600 to-indigo-600' : 'bg-zinc-300'
                    } ${item.required ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    aria-label={`Consentement ${type}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        granted ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Expand/collapse */}
          <div className="px-6 pt-3">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              disabled={submitting || loading}
              className="flex items-center gap-1.5 text-xs font-medium text-violet-600 transition hover:text-violet-800 disabled:opacity-50"
            >
              <span>{expanded ? 'Masquer les options' : 'Voir toutes les options'}</span>
              <svg
                viewBox="0 0 16 16"
                className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
          </div>

          {/* Actions */}
          <div className="mt-5 space-y-2 px-6 pb-5">
            <button
              type="button"
              onClick={() => saveChoices(true)}
              disabled={submitting || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Enregistrement...
                </>
              ) : (
                'Tout accepter'
              )}
            </button>

            <button
              type="button"
              onClick={() => saveChoices(false)}
              disabled={submitting || loading}
              className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Enregistrer mes choix
            </button>
          </div>

          {/* Privacy link */}
          <div className="border-t border-zinc-100 px-6 py-3 text-center">
            <a
              href={PRIVACY_POLICY_URL[locale]}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-zinc-400 underline underline-offset-2 transition hover:text-violet-600"
            >
              Politique de confidentialité
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
