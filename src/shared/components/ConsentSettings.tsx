import { useMemo } from 'react'
import { CONSENT_TYPE_LIST, CONSENT_TYPES, type SupportedLocale } from '../lib/consentPolicy'
import { useConsent } from '../hooks/useConsent'

type ConsentSettingsProps = {
  locale?: SupportedLocale
}

export function ConsentSettings({ locale = 'fr' }: ConsentSettingsProps) {
  const { hasConsent, updateConsent, loading, lastUpdatedAt } = useConsent()

  const formattedLastUpdate = useMemo(() => {
    if (!lastUpdatedAt) {
      return '—'
    }

    const date = new Date(lastUpdatedAt)
    if (Number.isNaN(date.getTime())) {
      return '—'
    }

    return date.toLocaleString('fr-FR')
  }, [lastUpdatedAt])

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Préférences de consentement</h2>
        <p className="text-xs text-zinc-400">Mis à jour: {formattedLastUpdate}</p>
      </div>

      <div className="space-y-3">
        {CONSENT_TYPE_LIST.map((type) => {
          const item = CONSENT_TYPES[type]
          const granted = hasConsent(type)

          return (
            <div key={type} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{item.title[locale]}</p>
                  <p className="mt-1 text-xs text-zinc-400">{item.description[locale]}</p>
                </div>

                <button
                  type="button"
                  onClick={() => updateConsent(type, !granted).catch(() => undefined)}
                  disabled={item.required || loading}
                  className={`relative h-6 w-11 rounded-full transition ${granted ? 'bg-emerald-500' : 'bg-zinc-700'} ${item.required ? 'opacity-70' : ''}`}
                  aria-label={`Consentement ${type}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-zinc-100 transition ${granted ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          Promise.all([
            updateConsent('analytics', false),
            updateConsent('marketing', false),
            updateConsent('third_party', false),
          ]).catch(() => undefined)
        }}
        disabled={loading}
        className="mt-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-950/60 disabled:opacity-70"
      >
        Révoquer tout
      </button>
    </section>
  )
}
