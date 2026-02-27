import { useMemo, useState } from 'react'
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

export function ConsentModal({ locale = 'fr' }: ConsentModalProps) {
  const { consents, updateConsent, loading } = useConsent()
  const [expanded, setExpanded] = useState(false)
  const [choices, setChoices] = useState<Record<ConsentType, boolean>>({
    essential: true,
    analytics: false,
    marketing: false,
    third_party: false,
  })
  const [submitting, setSubmitting] = useState(false)

  const hasAnyConsent = consents.some((consent) => consent.policy_version === CURRENT_POLICY_VERSION)

  const initialChoices = useMemo(() => {
    const next: Record<ConsentType, boolean> = {
      essential: true,
      analytics: false,
      marketing: false,
      third_party: false,
    }

    for (const row of consents) {
      if (row.policy_version !== CURRENT_POLICY_VERSION) {
        continue
      }
      next[row.consent_type] = row.granted && !row.revoked_at
    }

    return next
  }, [consents])

  useMemo(() => {
    setChoices(initialChoices)
  }, [initialChoices])

  if (hasAnyConsent) {
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

    try {
      for (const type of CONSENT_TYPE_LIST) {
        const granted = type === 'essential' ? true : allAccepted ? true : choices[type]
        await updateConsent(type, granted)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-6">
        <header className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-zinc-100 text-center text-base font-bold leading-9 text-zinc-900">L</div>
          <div>
            <p className="text-sm text-zinc-400">LoyalUp</p>
            <h2 className="text-xl font-semibold">Avant de commencer</h2>
          </div>
        </header>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="space-y-3">
            {CONSENT_TYPE_LIST.map((type) => {
              const item = CONSENT_TYPES[type]
              const visible = expanded || type === 'essential'

              if (!visible) {
                return null
              }

              return (
                <div key={type} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{item.title[locale]}</p>
                      <p className="mt-1 text-xs text-zinc-400">{item.description[locale]}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle(type)}
                      disabled={item.required || submitting || loading}
                      className={`relative h-6 w-11 rounded-full transition ${
                        choices[type] ? 'bg-emerald-500' : 'bg-zinc-700'
                      } ${item.required ? 'opacity-70' : ''}`}
                      aria-label={`Consentement ${type}`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-zinc-100 transition ${
                          choices[type] ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => saveChoices(true)}
              disabled={submitting || loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
            >
              Tout accepter
            </button>

            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              disabled={submitting || loading}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-70"
            >
              {expanded ? 'Masquer' : 'Personnaliser'}
            </button>

            <button
              type="button"
              onClick={() => saveChoices(false)}
              disabled={submitting || loading}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-70"
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
