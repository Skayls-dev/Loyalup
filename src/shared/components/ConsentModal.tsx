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
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900/95 text-zinc-100">
      <div className="mx-auto flex h-full max-w-lg flex-col justify-start px-4 py-6 sm:justify-center">
        <header className="mb-4 flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-base font-bold text-zinc-900 shadow-lg shadow-black/30">L</div>
          <div>
            <p className="text-sm text-zinc-400">LoyalUp</p>
            <h2 className="text-[1.85rem] font-semibold leading-tight">Avant de commencer</h2>
          </div>
        </header>

        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
          <div className="space-y-3">
            {CONSENT_TYPE_LIST.map((type) => {
              const item = CONSENT_TYPES[type]
              const visible = expanded || type === 'essential'

              if (!visible) {
                return null
              }

              return (
                <div key={type} className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[1rem] font-semibold text-zinc-100">{item.title[locale]}</p>
                      <p className="mt-1 text-sm text-zinc-400">{item.description[locale]}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle(type)}
                      disabled={item.required || submitting || loading}
                      className={`relative h-7 w-12 rounded-full transition ${
                        choices[type] ? 'bg-emerald-500' : 'bg-zinc-700'
                      } ${item.required ? 'opacity-70' : ''}`}
                      aria-label={`Consentement ${type}`}
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-zinc-100 transition ${
                          choices[type] ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => saveChoices(true)}
              disabled={submitting || loading}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
            >
              Tout accepter
            </button>

            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              disabled={submitting || loading}
              className="rounded-xl border border-zinc-700 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-70"
            >
              {expanded ? 'Masquer' : 'Personnaliser'}
            </button>

            <button
              type="button"
              onClick={() => saveChoices(false)}
              disabled={submitting || loading}
              className="rounded-xl border border-zinc-700 px-4 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-70"
            >
              Enregistrer mes choix
            </button>
          </div>

          <a
            href={PRIVACY_POLICY_URL[locale]}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-xs text-blue-400 hover:text-blue-300"
          >
            Voir la Politique de confidentialité
          </a>
        </div>
      </div>
    </div>
  )
}
